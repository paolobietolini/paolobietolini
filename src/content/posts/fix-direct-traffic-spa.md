---
title: Fixing Direct Traffic Inflation in GA4 for Single Page Applications
date: 2021-01-30
lang: en
description: Fix inflated Direct traffic in GA4 for SPAs built with React, Next.js, or Nuxt.js. GTM implementation guide for proper page_referrer tracking on History Change events.
tags: [ga4, spa, attribution]
---

## The Problem

If you're running a Single Page Application (SPA) built with frameworks like **Nuxt.js**, **Next.js**, **React Router**, or **Vue Router**, you might notice an unusually high percentage of **Direct traffic** in your Google Analytics 4 reports.

This happens because:

1. **SPAs don't trigger traditional page loads** - When users navigate between pages, the browser doesn't perform a full page reload. Instead, JavaScript updates the content dynamically.

2. **`document.referrer` doesn't update on SPA navigation** - The browser's `document.referrer` only captures the referrer from the initial page load. It doesn't change when users navigate within your SPA.

3. **GA4's `page_referrer` parameter is empty or stale** - Without proper configuration, GA4 receives an empty `dr` (document referrer) parameter, causing it to classify sessions as "Direct" even when users came from other pages on your site or external sources.

## Diagnosing the Issue

### Symptoms

- Abnormally high Direct traffic percentage (often 40-60%+)
- Low page depth per session despite good engagement
- Attribution issues affecting campaign performance analysis

### How to Confirm

1. Open your browser's Developer Tools → Network tab
2. Navigate between pages on your SPA
3. Filter for requests to `google-analytics.com` or your server-side endpoint
4. Look at the `dr` parameter in the GA4 collect requests

If `dr=` is empty on internal navigations, you have this issue:

```
/g/collect?v=2&tid=G-XXXXXX&...&dr=&dl=https://yoursite.com/page2/...
                                ^^^
                                Empty!
```

## The Solution

### Overview

We need to:

1. **Track SPA navigations** using GTM's History Change trigger
2. **Capture the previous page URL** and pass it as `page_referrer`
3. **Prevent duplicate page views** on initial page load

### Implementation in Google Tag Manager

#### Step 1: Create the Page Referrer Variable

Create a **Custom JavaScript** variable that returns the correct referrer for both scenarios:

**Variable Name:** `CJ - Page Referrer (SPA)`

```javascript
function() {
  // Get the old URL from History Change event (for SPA navigations)
  var dataLayer = window.dataLayer || [];
  var historyOldUrl = null;

  // Find the most recent gtm.historyChange event
  for (var i = dataLayer.length - 1; i >= 0; i--) {
    if (dataLayer[i].event === 'gtm.historyChange' && dataLayer[i]['gtm.oldUrl']) {
      historyOldUrl = dataLayer[i]['gtm.oldUrl'];
      break;
    }
  }

  // If we have a history old URL and it's different from current URL, use it
  if (historyOldUrl && historyOldUrl !== window.location.href) {
    return historyOldUrl;
  }

  // Otherwise, return document.referrer (for initial page load)
  return document.referrer || '';
}
```

#### Step 2: Create a Helper Variable to Detect Same-URL History Changes

Some SPAs trigger `replaceState` on initial load where `oldUrl === newUrl`. We need to block these to prevent duplicate page views.

**Variable Name:** `CJ - Is Same URL (History Change)`

```javascript
function() {
  var dataLayer = window.dataLayer || [];

  // Find the most recent gtm.historyChange event
  for (var i = dataLayer.length - 1; i >= 0; i--) {
    if (dataLayer[i].event === 'gtm.historyChange') {
      var oldUrl = dataLayer[i]['gtm.oldUrl'] || '';
      var newUrl = dataLayer[i]['gtm.newUrl'] || '';
      return oldUrl === newUrl;
    }
  }

  return true; // Block if no history change found
}
```

#### Step 3: Create the History Change Trigger

Create a new trigger:

- **Trigger Name:** `History Change - SPA Navigation`
- **Trigger Type:** History Change
- **Fires on:** All History Changes

#### Step 4: Create the Blocking Trigger

Create a trigger to prevent firing when it's not a real navigation:

- **Trigger Name:** `Block - Same URL History Change`
- **Trigger Type:** Custom Event
- **Event Name:** `.*` (regex match all)
- **Fire when:** `{{CJ - Is Same URL (History Change)}}` equals `true`

#### Step 5: Create the SPA Page View Tag

Create a new GA4 Event tag:

- **Tag Name:** `GA4 - Event - Page View (SPA Navigation)`
- **Tag Type:** Google Analytics: GA4 Event
- **Measurement ID:** Your GA4 ID (or use a variable)
- **Event Name:** `page_view`
- **Event Parameters:**
  - `page_referrer`: `{{CJ - Page Referrer (SPA)}}`
  - `page_location`: `{{Page URL}}`
  - `page_title`: `{{Page Title}}`
- **Firing Trigger:** `History Change - SPA Navigation`
- **Blocking Trigger:** `Block - Same URL History Change`

#### Step 6: Update Your Existing Page View Tag

Add the `page_referrer` parameter to your existing Page View tag (the one that fires on initial page load):

- **Event Parameters:**
  - `page_referrer`: `{{CJ - Page Referrer (SPA)}}`

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                        Initial Page Load                        │
├─────────────────────────────────────────────────────────────────┤
│  1. User lands on your site from Google                         │
│  2. Original Page View tag fires                                │
│  3. page_referrer = document.referrer (google.com)              │
│  4. GA4 correctly attributes: Organic Search                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     SPA Navigation                              │
├─────────────────────────────────────────────────────────────────┤
│  1. User clicks internal link (Home → Product Page)             │
│  2. History Change event fires                                  │
│  3. SPA Page View tag fires                                     │
│  4. page_referrer = gtm.oldUrl (your homepage)                  │
│  5. GA4 maintains session continuity                            │
└─────────────────────────────────────────────────────────────────┘
```

## Additional Considerations

### Server-Side Tagging

If you're using server-side GTM (Stape, Addingwell, etc.), ensure your server-side GA4 tag is configured to forward the `page_referrer` parameter from the client.

### Disable Conflicting Enhanced Measurement

In GA4 Admin → Data Streams → Enhanced Measurement, consider disabling **"Page changes based on browser history events"** to prevent duplicate tracking. GTM will handle this instead.

### Testing

1. Open GTM Preview mode
2. Navigate to your site
3. Click through several pages
4. Verify in the Preview panel:
   - Initial load: Original Page View tag fires with external referrer
   - SPA navigation: SPA Page View tag fires with internal referrer
   - No duplicates on initial `replaceState` events

## Results

After implementing this solution:

- ✅ **Accurate traffic source attribution** - Sessions maintain their original source
- ✅ **Proper page path tracking** - All virtual pageviews are captured
- ✅ **Reduced Direct traffic** - Only truly direct visits are classified as Direct
- ✅ **Better session stitching** - GA4 can properly connect page views within sessions

## Common Pitfalls

1. **Don't forget the blocking trigger** - Without it, you may get duplicate page views
2. **Test thoroughly** - SPAs vary in how they handle routing; test your specific framework
3. **Check consent timing** - Ensure consent is granted before page view tags fire
4. **Coordinate with developers** - For best results, have developers push a custom `virtualPageview` event with all necessary data

---

## Related Resources

- [Server-Side Tracking Overview](/posts/server-side-tracking-overview/) - For more advanced tracking implementations
- [GA4 Debug Mode: Complete Troubleshooting Guide](/posts/ga4-debug-mode-guide/) - Debug and verify your SPA tracking setup

---

_This solution was implemented for a Nuxt.js e-commerce site experiencing 50%+ Direct traffic. After deployment, Direct traffic dropped to expected levels (~15-20%) and campaign attribution improved significantly._
