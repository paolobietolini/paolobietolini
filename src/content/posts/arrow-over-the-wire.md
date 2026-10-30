---
title: Arrow over the wire
date: 2026-04-18
lang: en
description: "Four lines of Spark config to read BigQuery. Underneath: a gRPC read session, one stream per Spark partition, Arrow end-to-end, server-side column and filter pushdown, and dynamic rebalancing when executors finish early. A walkthrough of what those lines actually trigger — and why the middle format isn't replaced with something better, it's removed."
tags: [bigquery, spark, performance]
---

## What the Spark BigQuery connector actually does

In the [last post](/posts/a-nan-where-a-long-should-be/) I ended on this:

```python
from pyspark.sql import SparkSession

spark = (
    SparkSession.builder
    .config("spark.jars.packages", "com.google.cloud.spark:spark-4.0-bigquery:0.44.1")
    .getOrCreate()
)

spd = (
    spark.read.format("bigquery")
    .option("table", "bq-project.analytics123456.events_20260301")
    .load()
)
```

Four lines of configuration. No pandas, no Arrow file, no `write.parquet` / `read.parquet` round trip. Data shows up in a Spark DataFrame.

That last post made the case that pandas was the wrong intermediate format and that Arrow was a better one. That argument led to a twelve-line script: query BigQuery, write to `/tmp/ga4.parquet`, read it back in Spark. Correct, but still going through an intermediate file on the driver. For small tables that's fine. For a full GA4 day on a trafficked site, `to_arrow()` tries to pull millions of rows into the Python driver's memory, and the driver dies before Spark ever sees the data.

The connector fixes that. It also does a lot of other things that aren't obvious from looking at four lines of config. This post is about what happens between `spark.read` and the DataFrame arriving , what each of those lines is actually doing, and why the result is fundamentally different from anything you can build on top of the Python client.

## Three ways to read from BigQuery, and why the third one exists

Historically, BigQuery gave you two ways to get table data out of it.

The first was the **REST API**: `tabledata.list` or `jobs.getQueryResults`. It returned rows as JSON, paginated, via HTTP. Fine for fetching the first thousand rows of something, useless for anything at scale , the pagination overhead dominates, the JSON serialisation is wasteful, and there's no parallelism.

The second was **export jobs**. You told BigQuery to write the table to Cloud Storage in CSV, JSON, or Avro, and then your downstream system read from there. Fast for bulk, but batch , you wait for the export to finish, you deal with temp files, and you're subject to daily export quotas. The old Spark–BigQuery integration worked this way, which is why even now you'll see `temporaryGcsBucket` as a connector option: it's the plumbing for the legacy write path.

The **Storage Read API** is the third option, and it exists because neither of the first two scaled in the right direction. It's an RPC-based API, binary wire format, built around the idea that a distributed reader wants to pull disjoint slices of a table in parallel, without waiting on a batch export and without JSON overhead. It is the substrate everything else in this post sits on top of.

Three things are worth knowing about it before we look at what the connector does with it.

**It's gRPC, not REST.** Clients open a streaming RPC and the server pushes serialised row batches over it, with flow control so the server doesn't drown a slow reader. If you come from REST-paginated world, this is the biggest mental shift: you don't poll for pages, you open a connection and data arrives.

**It works in Arrow or Avro.** The connector defaults to Arrow, which , as the previous post laboured to establish , preserves nested types, nullability, tz-aware timestamps, and decimal precision without translation. Every BigQuery type maps cleanly onto an Arrow logical type. `STRUCT` becomes `Struct`. `ARRAY` becomes `List`. `TIMESTAMP` becomes `Timestamp` at microsecond precision in UTC. `NUMERIC(P, S)` becomes `Decimal(P, S)`. Nothing gets lossily coerced on the way out of BigQuery.

**It's session-based, not request-based.** You don't make "reads"; you create a **read session**, and the session contains the parameters of the whole operation: which columns, which filter predicates, what point-in-time snapshot to read from. The server, at session-creation time, decides how to partition the table into **streams**, each of which represents roughly equal data. Each row in the table lives in exactly one stream. To read the whole result, you read all the streams. Sessions are guaranteed to stay valid for at least six hours, no cleanup required.

That last point is the one that makes everything else possible. The session is the unit that a distributed reader coordinates around.

## What the four-line connector is actually doing

Here's the connector snippet again, with the two lines that matter called out:

```python
spark = (
    SparkSession.builder
    .config("spark.jars.packages", "com.google.cloud.spark:spark-4.0-bigquery:0.44.1")  # ← (1)
    .getOrCreate()
)

spd = (
    spark.read.format("bigquery") # ← (2)
    .option("table", "bq-project.analytics123456.events_20260301")
    .load()
)
```

Line (1) pulls in a JAR that registers a Spark SQL **Data Source** called `bigquery`. Spark's read path is built around this abstraction: a data source is anything that knows how to (a) produce a schema and (b) produce a set of partitions, each of which knows how to produce rows. The connector implements both sides of that interface against the BigQuery Storage API. Everything else is plumbing.

Line (2) triggers a sequence that I'll walk through step by step, because the point of this post is that those four lines aren't a shortcut , they're a coordinated distributed read, and it's worth seeing where each moving part sits.

### Step 1: the driver creates a session

When `.load()` is called, the connector running on the Spark driver opens a gRPC connection to BigQuery and calls `CreateReadSession`. The request carries:

- the table reference
- the list of columns to read (inferred from Spark's projection, so if your DataFrame operations later do `.select("event_name", "user_id")`, only those columns end up in the session)
- any filter predicates the connector can push down (more on this below)
- a requested number of streams

The response carries:

- a session ID
- the **schema** of the result, in Arrow format
- a list of **stream identifiers**, one per partition

No data has moved yet. What's happened is that BigQuery has looked at the table, decided it will serve this read in , let's say , 47 streams, and handed back the 47 stream IDs plus a single schema that applies to all of them. The schema is sent once because it's identical across every stream in the session; the connector caches it and reuses it for every executor task.

### Step 2: streams become Spark partitions

Each stream ID becomes exactly one Spark partition. So if BigQuery returned 47 streams, Spark will execute this read as a stage with 47 tasks. Each task, when it runs on an executor, gets one stream ID to work with.

How many streams you get is controlled by two options with opaque names:

- `preferredMinParallelism` defaults to the smaller of (3 × Spark's default parallelism) and `maxParallelism`. Think of it as a floor.
- `maxParallelism` defaults to the larger of `preferredMinParallelism` and 20,000. Think of it as a ceiling.

The connector sends `maxParallelism` as the requested stream count. BigQuery is free to return fewer if it decides the data is small enough that further fan-out is wasteful. So on a tiny table you might get 3 streams where you asked for 20,000; on a multi-terabyte table you'll get something close to your ask. In practice the defaults work fine and most people never touch these.

There's a subtlety here. "Roughly equal" doesn't mean "exactly equal". BigQuery partitions at the granularity of row groups in its columnar storage format, so streams can have different row counts , and if you have a predicate filter, even more so, because some row groups may be fully excluded. So the 47 streams may each produce anywhere from, say, 80,000 to 150,000 rows. Spark doesn't know this upfront; it just schedules 47 tasks.

### Step 3: each executor opens a ReadRows stream

An executor gets assigned a task. The task holds a stream ID. The executor opens its own gRPC connection to BigQuery and calls `ReadRows` for that stream.

And then the server starts pushing.

Not paginating. Pushing. This is the bit that matters and that people who come from REST-API instincts sometimes miss. The executor opens one long-lived gRPC stream, and BigQuery streams Arrow record batches down it continuously. gRPC handles backpressure: if the executor is busy processing a batch, the server will wait before sending the next one. If the executor is idle for more than about an hour, BigQuery kills the stream to free resources, which is why very long pauses mid-read are bad and why the session-level six-hour cap also exists.

The Arrow record batches arriving at the executor go straight into Spark's internal columnar representation. No JSON parse step. No file write. No object creation per row. Arrow's memory layout is close enough to Spark's that the conversion is mostly pointer arithmetic and type tagging.

### Step 4: pushdown, so the server sends less

Back to the session-creation step for a moment, because there's something I glossed over.

When the connector calls `CreateReadSession`, it can include:

- a **column list** , only these columns are read from BigQuery's storage, serialised, and sent over the wire
- a **filter predicate** , rows matching the predicate are excluded server-side, before transmission

Both of these come from Spark's query plan. If you write:

```python
spd = (
    spark.read.format("bigquery")
    .option("table", "bq-project.analytics123456.events_20260301")
    .load()
    .select("event_name", "user_id")
    .filter("event_name = 'purchase'")
)
```

Spark's Catalyst optimizer pushes the `select` and `filter` down into the data source before triggering the read. The connector turns them into the column list and filter predicate in the `CreateReadSession` call. BigQuery, which stores data columnar (its storage format is called Capacitor), can satisfy both efficiently at the storage layer , it never reads the irrelevant columns off disk, and it skips row groups that can't match the predicate.

The practical effect is that the same pipeline over a 500-column table with a `.select("event_name", "user_id")` transfers under half a percent of the bytes that a full scan would. The columnar pushdown is not a small optimisation; it's the reason the Storage API is fast.

One known gap: Spark can't push down predicates over nested fields. `.filter("device.category = 'mobile'")` won't reach the server as a filter , it'll be applied on the executor after the full `device` struct arrives. If you're filtering on nested columns heavily, you're doing it post-transfer.

### Step 5: dynamic rebalancing, so no one executor holds everyone up

Streams are "roughly equal" up front, but in practice some finish early. One executor is done with its stream after 30 seconds; another is still halfway through a stream with a big row group at the end. Without intervention, the stage waits for the slow one.

The Storage API has a second RPC, `SplitReadStream`, which does what it sounds like: take a stream that still has unread data, split it into two child streams whose contents are back-to-back slices of the original. The first half stays with the original reader; the second half is a new stream identifier that can be handed to an idle executor.

The connector uses this to rebalance. When executors report in as free, the driver picks a still-running stream, splits it, and hands the residual to the free executor. Map phases end up finishing nearly concurrently, which matters when the whole stage has to complete before the next one starts. This is the same mechanism Cloud Dataflow uses for work rebalancing; Google [published on it](https://cloud.google.com/blog/products/gcp/no-shard-left-behind-dynamic-work-rebalancing-in-google-cloud-dataflow) years ago in the Dataflow context and the Storage API inherits it.

## So what does each config line buy you, concretely

Go back to the four-line snippet and match each piece against the machinery:

**The JAR (`spark.jars.packages`)** brings in the Data Source v2 implementation. Without it, `spark.read.format("bigquery")` throws `ClassNotFoundException`. This isn't a Python package , it's a JVM JAR that runs in-process with Spark, speaks gRPC to BigQuery, and implements Spark's internal read interface. The Python API you type is a thin wrapper around Java-side machinery.

**`spark.read.format("bigquery")`** selects that data source.

**`.option("table", ...)`** tells the driver-side connector what to create a read session against. At this point one RPC goes out to BigQuery and comes back with a schema and a list of stream IDs.

**`.load()`** returns a DataFrame whose physical plan is "read N partitions, each served by a stream". No data has actually transferred yet , Spark is lazy, and the reads will happen when a downstream operation forces materialisation (`.show()`, `.write`, `.count()`, etc.).

When that materialisation happens, each executor task opens its own gRPC stream, receives Arrow record batches, and feeds them into Spark's internal representation. Projections and filters from your DataFrame operations are pushed server-side. Stragglers get their streams split and redistributed. At no point does anything hit the driver except the initial schema.

That's the thing the previous post was pointing at when it called this "script 2 without the middle". The middle , pandas, the Parquet file, the driver-memory materialisation , isn't replaced with a better middle. It's removed. The executors pull Arrow directly from BigQuery's Storage API servers, each reading a distinct slice, and the driver only coordinates.

## When the connector isn't the answer

A few situations where the connector isn't the right tool, to keep the case honest.

**Running outside GCP with no egress allowance.** The Storage API egresses data, and BigQuery charges for cross-region and inter-cloud traffic. If your Spark cluster isn't in the same region as the dataset, you'll pay per-byte. The REST API and export jobs have the same costs in principle, but the connector's high-throughput parallelism makes the number move faster.

**Reads of views or external tables.** The Storage API reads BigQuery-managed storage directly. Views aren't stored , they're query definitions , so the connector has to materialise them to a temp table first, which costs a query. External tables (Cloud Storage, Bigtable, etc.) aren't readable through the Storage API at all, unless wrapped as BigLake tables.

**Very small data, very frequently.** Session setup is cheap but not free, and for a few hundred rows pulled every five seconds the overhead dominates. For anything at a human-interactive scale , notebooks, dashboards querying small result sets , the REST-based `client.query().to_dataframe()` path is fine, and the fact that it's "wrong" at scale doesn't matter when the scale isn't there.

**Authentication constraints.** The connector needs credentials with `bigquery.readSessionUser` plus table-level read permissions. If you're in an environment where those can't be granted, you're stuck. This is rare but it happens in tightly-controlled enterprise setups.

**Write paths with strong consistency requirements.** This post has been about reads. The connector can write too, via either the Storage Write API (direct) or GCS-staged loads (indirect). The direct write path is in preview and has edge cases worth reading about before committing to it. That's a separate article.

## Closing

The previous post's rule was: when you're writing serialisation code between two typed systems, the format in the middle is lossy. The fix was to replace pandas with Arrow , a format with enough type system to carry everything across.

This post's follow-up is: when both systems natively speak the same format, you can remove the middle entirely. The connector is Arrow at the source, Arrow on the wire, Arrow in Spark's executors. There is no translation step because there's nothing to translate. The four lines of configuration are short because the hard work , the parallelism, the rebalancing, the schema passthrough, the pushdown , lives inside the Storage API and the Data Source v2 interface, and the connector is just the thin layer that wires them together.

The reason this is worth knowing, even if you mostly just want to read BigQuery data into Spark and never look at Storage API internals, is that the same shape of problem , "A speaks format X, B speaks format X, I'm writing glue between them" , comes up everywhere. Postgres' logical replication. Kafka Connect. Iceberg readers. The pattern is always the same: push format fidelity to the edges, make the middle transparent, let both systems coordinate directly. The BigQuery connector is one instance of that pattern. Once you see the pattern, you stop reaching for pandas-shaped glue as a first instinct, and you start asking whether the pivot format is the problem.

## Related Resources

- [A NaN where a Long should be](/posts/a-nan-where-a-long-should-be/) - The companion article that sets up why the connector's approach matters
- [BigQuery Storage Read API documentation](https://cloud.google.com/bigquery/docs/reference/storage) - Official reference for the RPC-based API underlying the connector (sessions, streams, Arrow schema)
- [spark-bigquery-connector on GitHub](https://github.com/GoogleCloudDataproc/spark-bigquery-connector) - Source and README, including all read/write options and the parallelism defaults
- [No shard left behind: dynamic work rebalancing in Cloud Dataflow](https://cloud.google.com/blog/products/gcp/no-shard-left-behind-dynamic-work-rebalancing-in-google-cloud-dataflow) - The rebalancing mechanism the Storage API inherits, explained in the Dataflow context
- [Inside Capacitor, BigQuery's columnar storage format](https://cloud.google.com/blog/big-data/2016/04/inside-capacitor-bigquerys-next-generation-columnar-storage-format) — Why column pushdown is free on the BigQuery side, not just less expensive
- [Apache Arrow project](https://arrow.apache.org/) - The columnar memory format that travels end-to-end from BigQuery to Spark executors
- [Everything you should know when fetching data from Google BigQuery to Apache Spark](https://www.datumo.io/blog/everything-you-should-know-when-fetching-data-from-google-bigquery-to-apache-spark) - The first article that introduced me to the connector discussed above
