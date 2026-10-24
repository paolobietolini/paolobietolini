---
title: "How GA4 Counts Millions of Users with 12 Kilobytes: The HyperLogLog Algorithm"
date: 2026-01-01
lang: en
description: "Open any GA4 report and look at Total Users. Then run COUNT(DISTINCT user_pseudo_id) in your BigQuery export. The numbers won't match. They're usually within a percent or two, and there is no setting that makes them. That gap isn't a bug, and it isn't sampling. It's a deliberate engineering decision: GA4 never actually counts your users. It estimates them, using a probabilistic data structure called HyperLogLog++ that can approximate the number of unique items in a set of any size using a fixed 12 KB of memory."
---

Open any GA4 report and look at **Total Users**. Then run `COUNT(DISTINCT user_pseudo_id)` on the same date range in your BigQuery export. The numbers won't match. They're usually within a percent or two — but they won't match, and there is no setting that makes them.

That gap isn't a bug, and it isn't sampling. It's a deliberate engineering decision: GA4 never actually counts your users. It *estimates* them, using a probabilistic data structure called **HyperLogLog++** that can approximate the number of unique items in a set of any size using a fixed 12 KB of memory.

Twelve kilobytes — a budget that never grows, whether you had ten thousand users yesterday or a hundred million. And it's enough to tell those two apart with an error under one percent.

Here's how that's possible, and why it should change the way you read your own reports.

## The problem: counting is expensive

To count *distinct* things exactly, you have to remember everything you've already seen — otherwise you can't tell a new user from a returning one. So an exact count means storing every unique ID and deduplicating against it.

Do the arithmetic at scale. A hundred million unique IDs, at roughly 8 bytes each, is about 800 MB — for a single metric, on a single segment, for a single day. Now serve that on demand, across every property, every report, and every date range a user might click. It doesn't work. So Google doesn't do it.

## The trick: stop counting, start observing

The core idea is almost suspiciously simple.

Hash every ID into a uniformly random bit string. In a random string, each bit is 0 or 1 with equal probability. So the chance a hash *starts* with at least *k* leading zeros is 1/2^k: one leading zero is a coin flip, two in a row is 1-in-4, ten in a row is roughly 1-in-1000.

Flip that around. If the longest run of leading zeros you've seen across all your hashes is *k*, you have probably processed somewhere around 2^k distinct values. Rare patterns only show up once you've made enough attempts.

It's the coin-flip intuition. If someone tells you the most heads they ever flipped in a row was three, you'd guess they flipped a handful of times. If they say twenty in a row, you'd guess something closer to a million. You're estimating the size of a set purely from the most extreme pattern it produced — without remembering a single flip.

## From a wild guess to a real estimate

One problem: a single "longest run" is wildly noisy. One unusually lucky hash and your estimate is off by orders of magnitude.

The fix is to average many independent observations. Use the first few bits of each hash to sort it into one of *m* buckets, and track the longest leading-zero run *within each bucket* separately. Each bucket becomes its own tiny, noisy estimator; combine them and the noise averages out.

HyperLogLog combines them with the *harmonic* mean (which resists a single outlier bucket blowing up the result) and a small correction constant. Averaging across *m* buckets brings the relative error down to about **1.04 / √m**. More buckets, more accuracy — and a little more memory. That trade-off is the entire tuning knob.

## Why exactly 12 KB

Now the payoff of the title.

GA4 uses precision **p = 14** for user counts. That means m = 2^14 = **16,384 buckets**. Each bucket only has to store one small integer — the longest leading-zero run it has seen — and for a 64-bit hash that value never exceeds about 50, which fits in 6 bits.

> 16,384 buckets × 6 bits = 98,304 bits = 12,288 bytes = **exactly 12 KB**.

(Sanfilippo walks through this same derivation for Redis — identical 16,384 registers, 6-bit ceiling, 12 KB.)"

That's the whole footprint. Not 12 KB per user — 12 KB *total*, for the entire metric, at any cardinality. And the standard error at p = 14 is 1.04 / √16,384 = **0.81%**. Double that for a 95% interval and you get the "~1.6% accuracy for users" figure you'll see quoted for GA4.

This is also where the strange name comes from. Each register stores a number that is itself roughly the *logarithm* of the count, and storing that number takes the logarithm of *that* — log log n. Hence LogLog, which became HyperLogLog once the harmonic-mean refinement was added on top.

## The "++": what Google actually shipped

The original HyperLogLog (Flajolet et al., 2007) is elegant but has rough edges at the extremes. In 2013, three Google engineers — Stefan Heule, Marc Nunkesser, and Alexander Hall — published **HyperLogLog++**, the version that now runs almost everywhere: BigQuery, Redis, Spark, and GA4. Three improvements matter:

1. **64-bit hashes** instead of 32-bit. A 32-bit hash only has about 4 billion possible values, and its accuracy degrades well before that ceiling — once you're counting in the hundreds of millions, collisions start distorting the estimate. Real websites hit that range. 64 bits pushes the ceiling out of reach for any realistic dataset.
2. **Sparse representation.** When you've only seen a few hundred values, keeping all 16,384 registers is both wasteful and inaccurate. HLL++ instead stores a compact list of `(bucket, value)` pairs — smaller *and* near-exact for small sets — and only "explodes" into the full register array once it has to.
3. **Bias correction.** The raw estimator is biased in the mid-range. HLL++ applies empirically measured corrections there, and falls back to a different estimator (linear counting) below a threshold.

Redis added HyperLogLog as a native type shortly after, in April 2014, and Salvatore Sanfilippo's write-up remains one of the clearest programmer-level explanations of the algorithm.

Hold on to that second point — it quietly kills a myth we'll get to shortly.

## Back to GA4

Google applies HLL++ to **Active Users, Total Users, and Sessions** — in fact to every user metric except *New Users*, and to every session metric. Users use precision 14; sessions use precision 12, which is why sessions are noisier (4,096 buckets → ~1.6% standard error, roughly ±3.3% at 95%).

It applies everywhere the number surfaces: standard reports, Explorations, and the Data API. It's active whether or not a report is flagged as "sampled" — sampling and HLL++ are entirely different mechanisms. And unlike Universal Analytics, there's no toggle. If you're reading a user or session count anywhere in GA4, you're reading an estimate.

## What this means when you actually use the data

**Reconciliation.** Your GA4 users will never exactly equal BigQuery's `COUNT(DISTINCT user_pseudo_id)`. Expect a percent or two. That's the algorithm, not a tracking gap. When you need the true number, compute it in BigQuery — that's the one place with the raw rows.

**Segments that don't add up.** Each segment's count is estimated independently, so New + Returning won't sum cleanly to Total, and slicing a report five ways gives you five separate approximations. The errors are small, but they don't cancel — they just fail to line up.

**The low-traffic myth.** You'll read that HLL is "way off on small segments." For HLL++ specifically, that's backwards: the sparse representation makes small sets *near-exact*. What actually distorts low-traffic GA4 segments is thresholding (rows withheld for privacy), `(other)` grouping, and modeling — not the cardinality estimator. Don't blame HLL for what data thresholds are doing.

**Deltas are where it bites.** The one place to be genuinely careful is percentage changes and A/B tests. A "+18% week over week" is the difference of two independent estimates, each carrying its own ~1% error, and the noise on that delta can be larger than it looks. For anything with a statistical decision attached, go to BigQuery and count exactly.

**Don't chase the last 1–2%.** It's dwarfed by Consent Mode, ITP, ad blockers, and bots. Reconciling GA4 to the decimal is almost always wasted effort.

## The part nobody talks about: sketches merge

Here's the property that makes HLL++ genuinely powerful rather than just clever: the sketches are **composable**. Two 12 KB sketches can be merged into a single 12 KB sketch that estimates the *union* — without ever revisiting the underlying data.

In practice, you precompute one daily sketch, then answer "unique users over the last 7 / 30 / 90 days" by merging the relevant days in milliseconds, instead of rescanning millions of rows for every window.

```sql
-- Step 1: one row per day, storing a 12 KB sketch. Save this as a table.
SELECT
  event_date,
  HLL_COUNT.INIT(user_pseudo_id, 14) AS users_sketch
FROM `your_project.analytics_123456789.events_*`
GROUP BY event_date;

-- Step 2: unique users across any window, cheaply, from the daily sketches.
SELECT HLL_COUNT.MERGE(users_sketch) AS users_30d
FROM daily_sketches
WHERE event_date BETWEEN '20260601' AND '20260630';
```

Match GA4's precision — 14 for users, 12 for sessions — and your BigQuery estimates will track the UI closely. Use `COUNT(DISTINCT ...)` when you want ground truth, and `APPROX_COUNT_DISTINCT(...)` or the `HLL_COUNT.*` family when you want speed and mergeability.

## The takeaway

GA4 isn't hiding your users or getting the arithmetic wrong. It made the trade every large-scale system eventually makes: a bounded, sub-1% error in exchange for counting *anything*, at *any* scale, in constant memory. Once you know that "Total Users" is a 12 KB statistical fingerprint and not a tally, the small discrepancies stop being mysterious — and you know exactly when to reach for BigQuery instead.

Twelve kilobytes to count the web. That's not a limitation. That's the whole point.

---

### Further reading

- Google Analytics — *Unique count approximation in Google Analytics* (Minhaz Kazi): https://developers.google.com/analytics/blog/2022/hll
- Google Analytics — *Bridge the gap between the GA UI and BigQuery export*: https://developers.google.com/analytics/blog/2023/bigquery-vs-ui
- Heule, Nunkesser & Hall (2013), *HyperLogLog in Practice: Algorithmic Engineering of a State of the Art Cardinality Estimation Algorithm*: https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/40671.pdf
- BigQuery `HLL_COUNT` functions: https://cloud.google.com/bigquery/docs/reference/standard-sql/hll_functions
- Salvatore Sanfilippo (antirez), *Redis new data structure: the HyperLogLog* (2014): https://antirez.com/news/75