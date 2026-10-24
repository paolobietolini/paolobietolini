---
title: A NaN where a Long should be
date: 2026-04-18
lang: en
description: A PySpark TypeError that looked like a schema bug was actually three steps upstream. Pandas can't represent what BigQuery hands it, (nested structs, nullable integers, timezone-aware timestamps, arbitrary-precision numerics) so every downstream line is a patch against a loss that happened at the moment pandas entered the pipeline. A walk to a twelve-line Arrow replacement, and the rule it points at.
---

## Introduction

### On using pandas as a pivot format between typed systems

As I am reading [Learning SQL](https://www.oreilly.com/library/view/learning-sql-3rd/9781492057604/) by Alan Beaulieu to consolidate the basics, during breaks I delve into things I am curious about.
Today I wanted to try to retrieve Big Query data using its [Python library](https://docs.cloud.google.com/python/docs/reference/bigquery/latest).
My goal is to improve my skills towards Analytics Engineering / Data Engineering so I am giving myself small problems whose resolutions might come in handy when working on bigger pipelines.

The library's query method returns a `RowIterator` you can loop over and do something with. Three lines. Boring.
I wanted something closer to the tools used in professional pipelines.

I wanted BigQuery data in a Spark DataFrame. The path I reached for first was the one most people reach for first: pull the query results into pandas, then hand the pandas DataFrame to Spark. Three lines of glue, surely.
The pipeline ran for a while, then died on this:

```bash
pyspark.errors.exceptions.base.PySparkTypeError: [FIELD_DATA_TYPE_UNACCEPTABLE_WITH_NAME]
field user_first_touch_timestamp: LongType() can not accept object nan in type <class 'float'>.
```

The obvious read: I declared a column as `LongType`, Spark found a float `nan` in it, the refusal is correct, fix my schema or fix my data.

> 💡 The GA4 export schema for Big Query is available [here](https://support.google.com/analytics/answer/7029846?hl=en)

The read is wrong though. The column in BigQuery is a nullable `INT64`. It arrived in pandas as nullable `Int64` (Capital I pandas' dtype (cf: [https://pandas.pydata.org/docs/reference/api/pandas.Int64Dtype.html](https://pandas.pydata.org/docs/reference/api/pandas.Int64Dtype.html))).

It became a float `nan` somewhere between pandas and Spark, without in my code ever touching it.

The error is pointing at the last step of a bug that happened three steps earlier.
Told you the first approach was boring. This one isn't.

This post is about that gap. About why, when you put pandas in the middle of two systems with richer types than pandas has, you start writing patches against symptoms rather than fixing causes and about what actually fixes it.

## The script that produced the error

Here's the long version of the code, cut down slightly for readability.
Read past it; I'll come back to specific parts:

```python
from google.cloud import bigquery
import pandas as pd
import numpy as np
import json
from pyspark.sql import SparkSession, functions as F
from pyspark.sql.types import *

spark = SparkSession.builder.getOrCreate()

def serialize_cell(x):
    if x is None or (isinstance(x, float) and np.isnan(x)):
        return None
    if isinstance(x, np.ndarray):
        return json.dumps(x.tolist())
    if isinstance(x, (dict, list)):
        return json.dumps(x)
    return x

def pandas_dtype_to_spark(dtype):
    if pd.api.types.is_integer_dtype(dtype): return LongType()
    if pd.api.types.is_float_dtype(dtype):   return DoubleType()
    if pd.api.types.is_bool_dtype(dtype):    return BooleanType()
    return StringType()

client = bigquery.Client(project="bq-project")
df = client.query(
    "SELECT * FROM `bq-project.analytics123456.events_*` "
    "WHERE _TABLE_SUFFIX = '20260301'"
).to_dataframe(create_bqstorage_client=True)

# Drop columns that are entirely null — Spark cannot infer type from them
null_cols = [c for c in df.columns if df[c].isna().all()]
df = df.drop(columns=null_cols)

# Serialize object columns: ndarrays, dicts, lists -> JSON strings
for col in df.columns:
    if df[col].dtype == object:
        df[col] = df[col].apply(serialize_cell)

# Build an explicit Spark schema from pandas dtypes
schema = StructType([
    StructField(c, pandas_dtype_to_spark(df[c].dtype), True)
    for c in df.columns
])
spd = spark.createDataFrame(df, schema=schema)

# Reparse the JSON strings back into real nested Spark types
event_params_schema = ArrayType(StructType([
    StructField("key", StringType()),
    StructField("value", StructType([
        StructField("string_value", StringType()),
        StructField("int_value", LongType()),
        StructField("float_value", FloatType()),
        StructField("double_value", DoubleType()),
    ])),
]))
# ... and similar hand-written schemas for user_properties, items, device ...

for name, sch in nested_schemas.items():
    if name in spd.columns:
        spd = spd.withColumn(name, F.from_json(F.col(name), sch))

```

Something like 150 lines by the time every GA4 nested column has its schema written out. It worked, mostly, but every block is doing one specific thing and it's the same thing: papering over a place where pandas couldn't hold what BigQuery handed it.

## Every patch is the same patch

**Dropping all-null columns.** Pandas infers a column's type by looking at its values. If every value is null, it gives up and leaves the column as `object`, which maps to nothing useful downstream. So we drop those columns.

Which means the shape of our output depends on whether the data we happened to pull had an, for instance, `ecommerce` event in it. Run this on two different days, get two different schemas. Try to union them, get a manual reconciliation job. BigQuery knew the type of ecommerce perfectly well, the schema was right there in the table. It's pandas that couldn't carry it across.

**`serialize_cell`.** Pandas has no nested type. A BigQuery `STRUCT` comes out as a Python `dict`. A `REPEATED` field comes out as a numpy `ndarray` of dicts. Both get stuffed into `object` columns and promptly confuse every downstream consumer. So we flatten them to JSON strings to get them through the pandas-to-Spark handoff. The nesting was fine in BigQuery and will be fine in Spark. Pandas is the only place it has nowhere to live.

**`pandas_dtype_to_spark`.** A hand-rolled translator from pandas dtypes to Spark types. There's a branch for ints, a branch for floats, a branch for bools, and a fallback to `StringType`. No branch for `datetime64`, if I'd had a proper `TIMESTAMP` column it would have silently become a string and nothing would have told me. No branch for `Decimal`, NUMERIC columns would have been coerced through float. The translator can only see what pandas kept, and pandas threw a lot away.

**`from_json` with hand-written schemas.** Having flattened the nested columns into JSON strings, I now have to reconstruct the nesting in Spark. That means writing out `event_params_schema`, `user_properties_schema`, `items_schema`, `device_schema` by hand, field by field. Google updates these schemas periodically. When they add a new value type to `event_params`, my `from_json` will silently return `null` for the new field because my schema doesn't declare it. I won't notice for months. The BigQuery schema has every field in it, it's right there, one API call away, but I'm reconstructing it by hand because the wire format I chose is JSON, which has no schema of its own.

**The nullable-int bridge bug.** The thing that produced the error. Pandas' nullable `Int64` uses `pd.NA` for missing values. Spark's `LongType` won't accept `pd.NA`. And when `createDataFrame` takes the non-Arrow path, it iterates the DataFrame as Python rows, and in that iteration `pd.NA` gets coerced to float `nan`. The schema is right. The data is right. The bridge is wrong.

Five different patches. One underlying problem: pandas doesn't have a faithful representation for what I pulled out of BigQuery — not for nested types, not for nullable integers, not for timestamps with timezone, not for decimals — and every patch in this script is me trying to undo one of those losses after the fact. You can patch forever. The set of losses isn't closed; it grows whenever BigQuery returns a type pandas doesn't model.

## Use a pivot format that doesn't lie

Here's the same pipeline with pandas removed from the middle and replaced with Arrow:

```python
from google.cloud import bigquery
from pyspark.sql import SparkSession
import pyarrow.parquet as pq

spark = SparkSession.builder.getOrCreate()

client = bigquery.Client(project="bq-project")
query_job = client.query(
    "SELECT * FROM `bq-project.analytics123456.events_*` "
    "WHERE _TABLE_SUFFIX = '20260301'"
)

arrow_table = query_job.to_arrow(create_bqstorage_client=True)
pq.write_table(arrow_table, "/tmp/ga4.parquet")
spd = spark.read.parquet("/tmp/ga4.parquet")
```

That's it. Every nested struct arrives as a struct. Every repeated field arrives as a list of structs. Nullable ints stay nullable ints. Timestamps keep their timezone. Numerics keep their precision. There is no `serialize_cell`, no `pandas_dtype_to_spark`, no hand-written `event_params_schema`. The schema flows from BigQuery to Spark intact because Arrow has enough type system to carry it and Parquet has enough type system to persist it.

Why does this work where pandas didn't? Two things Arrow has that pandas doesn't:

- **Nested types as first-class citizens.** `list<struct<...>>` is a real Arrow type, not an object column of dicts. So it survives the pivot instead of being flattened.
- **Null bitmaps per column at every nesting level.** There's no `NaN`-as-null hack because there's no need for one: nullability lives next to the values, not inside them.

And two more things worth noting:

- **The schema is data, not inferred.** `to_arrow` returns a table whose schema came from BigQuery directly, not from sampling rows. All-null columns keep their types. Empty result sets keep their types. The cross-day schema-drift problem from script 1 disappears.
- **Parquet is Arrow's on-disk form.** Writing Arrow to Parquet and reading it in Spark isn't two format conversions; it's one format with a serialisation in the middle. Nothing is re-inferred.
  The result is a twelve-line replacement for a hundred-and-fifty-line script, and the twelve lines are _more_ correct, not less. No silent type coercions, no silent schema drift, no hand-maintained schemas to drift out of date.

## The rule this points at

Pandas isn't the villain. For single-type tabular data that fits in memory, it's wonderful, and most of the time that's what people have. The problem is specific: when the source system has a richer type system than pandas (nested types, nullability as a first-class concept, timezone-aware timestamps, arbitrary-precision numerics) and you put pandas in the middle, information is lost at the moment data enters pandas, and every line downstream is a patch trying to undo the loss.

The smell is this: **if you're writing serialisation code between two typed systems, you're using a lossy pivot format.** `serialize_cell` and `from_json` in my original script are both serialisation code. They exist because the format in the middle couldn't hold what was on either side. When you see yourself writing that kind of code, the question to ask isn't "how do I serialise this better?" but "why is this format in the middle?"

Paolo Maldini said "_If I have to make a tackle then I have already made a mistake._" A great defender doesn't tackle, because their positioning made the tackle unnecessary. Serialisation code in the middle of a pipeline is the tackle.
The question isn't how to do it well but it's how to make the positioning right so you don't need to.

Usually one of two answers applies:

1. There's a pivot format with enough type system to hold the data (Arrow, in this case), and you should use that instead.
2. There's a direct connector that skips the pivot entirely, and you should use that instead.

Option 2, in the BigQuery-to-Spark case, is the `spark-bigquery-connector` that is four lines of configuration, no intermediate file, Spark reads from the BigQuery Storage API directly. [I'll write that one up separately](/posts/arrow-over-the-wire/), because what it's doing under the hood is genuinely interesting: it's Arrow over the wire, streamed to executors in parallel, which is script 2 without the "materialise to driver, write to disk, read from disk" middle.

For now, the takeaway is the smaller one: next time you reach for pandas as a bridge, ask whether the data on either side has types pandas doesn't represent. If it does, you're not writing a three-line integration. You're committing to a long list of patches against a format mismatch, and the patches will never quite finish.

The error message was lying to me because it had to. It was pointing at the place where the type collision finally produced a bad value, not at the place where the type was first lost. All of the patches in the long script were in the same position: treating the symptom at the last step, because the original step (the decision to go through pandas at all) was outside what any single line could reach.
