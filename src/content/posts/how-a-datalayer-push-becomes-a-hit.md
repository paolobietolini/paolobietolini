---
title: How a dataLayer push becomes a hit
date: 2026-08-03
lang: en
description: Following one dataLayer.push from the page to an analytics request, step by step.
---

Most tracking bugs I get asked to fix are not in the analytics tool. They sit somewhere between the line of code that pushes an event and the request that finally leaves the browser. So it is worth knowing exactly what happens in between.

## The push

The `dataLayer` is just an array that lives on `window`. Your site appends plain objects to it:

```js
window.dataLayer = window.dataLayer || [];
window.dataLayer.push({ event: 'add_to_cart', ecommerce: { currency: 'EUR', value: 49.9, items: [{ item_id: 'SKU-1042', quantity: 1 }] } });
```

Before the tag manager loads, that is all it is: an array with some objects in it. Nothing is sent anywhere.

## The takeover

When the tag manager container loads, it replaces `push` on that array with its own function. It then replays every object that was already in the array, in order, so events pushed before it loaded are not lost.

From now on, every push goes through the tag manager first. It merges the object into an internal data model. Keys you pushed earlier are still there unless you overwrite them, which is why a stale `ecommerce` object can leak into the next event if you forget to clear it.

## The trigger

If the object has an `event` key, the tag manager evaluates every trigger against it. A trigger is a set of conditions on that internal model: the event name, a URL, a variable. Every tag whose trigger matches gets queued.

Variables are resolved at this moment, not when the object was pushed. A variable that reads the DOM or a cookie reads it now. That timing is behind a surprising number of "the value was there when I checked" reports.

## The hit

Each queued tag builds its request. For a Google Analytics 4 event that is a request to the `collect` endpoint, with the event name and parameters encoded in the query string or body. The browser sends it with `sendBeacon` or `fetch`, and it shows up in the network panel as a single request.

That request is the only thing the analytics tool ever sees. Everything before it is local to the page.

## Debugging in that order

When numbers look wrong, I walk the same path:

1. Is the object in `window.dataLayer`, with the shape I expect?
2. Did the tag manager see it? Check the preview mode's event list.
3. Did the trigger match, and what did each variable resolve to at that moment?
4. Did the request leave the browser, and what does its payload say?

The first step that does not match is where the bug is. It is rarely the last one.
