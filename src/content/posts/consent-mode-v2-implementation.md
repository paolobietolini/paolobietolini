---
title: "GTM Consent Mode V2: Complete Implementation Guide"
date: 2025-12-22
lang: en
description: Implement Google Consent Mode V2 in GTM. Complete guide covering ad_user_data, ad_personalization parameters, basic vs advanced modes, CMP integration, and verification.
tags: [consent, gtm]
---

## Why Consent Mode V2 Matters

Since March 2024, Google requires Consent Mode V2 for all advertisers targeting users in the European Economic Area (EEA) and UK. Without it:

- **Remarketing audiences stop building** for new EEA users
- **Conversion tracking degrades** significantly
- **Google Ads optimization** loses signal quality
- **GA4 data modeling** becomes less accurate

This isn't a theoretical risk. If you're running Google Ads campaigns targeting Europe and haven't implemented Consent Mode V2, your campaigns are already underperforming.

---

## What Changed in V2

Consent Mode V1 had two main parameters:

- `ad_storage`: Controls advertising cookies (Google Ads, Floodlight)
- `analytics_storage`: Controls analytics cookies (GA4)

**V2 adds two new parameters:**

- `ad_user_data`: Controls sending user data to Google for advertising measurement
- `ad_personalization`: Controls using data for personalized advertising (remarketing)

The key difference: V1 only controlled _cookie placement_. V2 separates consent for _data collection_ from consent for _how that data is used_.

### Why This Matters

A user might accept analytics cookies but reject personalized advertising. V2 enables this granular choice:

| User Choice         | analytics_storage | ad_storage | ad_user_data | ad_personalization |
| ------------------- | ----------------- | ---------- | ------------ | ------------------ |
| Accept all          | granted           | granted    | granted      | granted            |
| Analytics only      | granted           | denied     | denied       | denied             |
| No personalized ads | granted           | granted    | granted      | denied             |
| Reject all          | denied            | denied     | denied       | denied             |

---

## Basic vs Advanced Consent Mode

Before implementation, decide which mode fits your needs.

### Basic Consent Mode

Tags **only fire when consent is granted**. If users deny consent, no data is sent to Google.

**Pros:**

- Simpler to implement
- Clearest privacy stance
- No data sent without explicit consent

**Cons:**

- Significant data loss from users who deny consent
- No conversion modeling for denied users
- Larger gaps in reporting

### Advanced Consent Mode

Tags **fire regardless of consent**, but behavior changes based on consent state:

- **Consent granted**: Full tracking with cookies
- **Consent denied**: Cookieless pings sent with limited data

These cookieless pings enable Google's conversion modeling, which uses machine learning to estimate conversions from users who denied consent.

**Pros:**

- Conversion modeling fills data gaps
- Better campaign optimization signals
- More complete attribution

**Cons:**

- Some data sent without full consent (though anonymized)
- More complex implementation
- Requires clear privacy policy disclosure

> **Recommendation**: For most businesses, Advanced Consent Mode provides significantly better data quality while remaining compliant. The cookieless pings contain no user identifiers and cannot be used for remarketing.

---

## Implementation Overview

Consent Mode requires two components:

1. **Default consent state**: Set _before_ any Google tags fire
2. **Consent update**: Trigger _when_ user makes a choice in your consent banner

The critical requirement: **defaults must load before any tracking code executes**.

---

## Method 1: Using a CMP with Native Integration

If you use a Consent Management Platform like Cookiebot, OneTrust, or Usercentrics, they likely have built-in Consent Mode V2 support.

### Cookiebot

1. In Cookiebot dashboard, enable **Google Consent Mode**
2. Select **Advanced** or **Basic** mode
3. The Cookiebot script automatically sends `gtag('consent', 'default')` and `gtag('consent', 'update')` calls

### OneTrust / CookiePro

1. Go to **Preference Center Settings > Google Consent Mode**
2. Enable Consent Mode and map your cookie categories
3. OneTrust handles the consent signals automatically

### Verification

After setup, use Chrome DevTools to verify:

1. Open Network tab, filter for `google-analytics` or `googleads`
2. Check request URLs for the `gcd` parameter (consent data)
3. The `gcd` value encodes all four consent states

---

## Method 2: GTM Implementation (Manual)

For custom consent solutions or CMPs without native integration, implement consent mode manually in GTM.

### Step 1: Enable Consent Overview

1. Go to **Admin > Container Settings**
2. Under **Additional Settings**, check **Enable consent overview**

This lets you see which tags require consent and their current configuration.

### Step 2: Create Default Consent Tag

Use a tag template from the Community Template Gallery or create a custom HTML tag.

**Option A: Simo Ahava's Consent Mode Template**

1. Go to **Templates > Search Gallery**
2. Search for "Consent Mode" by Simo Ahava
3. Add to workspace

Create a new tag using this template with defaults set to `denied` for EEA users.

**Option B: Custom HTML Tag**

Create a Custom HTML tag with this code:

```html
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    dataLayer.push(arguments);
  }

  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500,
  });
</script>
```

**Trigger**: Consent Initialization - All Pages

> **Critical**: The Consent Initialization trigger fires _before_ all other triggers, including Initialization triggers. This ensures defaults are set before any Google tags load.

### Step 3: Create Consent Update Tag

When users interact with your consent banner, fire a tag that updates consent state.

**Custom HTML Tag:**

```html
<script>
  gtag('consent', 'update', {
    ad_storage: '{{Consent - Ad Storage}}',
    ad_user_data: '{{Consent - Ad User Data}}',
    ad_personalization: '{{Consent - Ad Personalization}}',
    analytics_storage: '{{Consent - Analytics Storage}}',
  });
</script>
```

**Trigger**: Custom Event matching your CMP's consent-granted event (varies by CMP).

### Step 4: Create Consent State Variables

Create Data Layer or Custom JavaScript variables that return `'granted'` or `'denied'` based on your CMP's consent data.

**Example for cookie-based CMP:**

```javascript
// Custom JavaScript Variable: Consent - Analytics Storage
function() {
  var consent = {{Cookie - Consent Preferences}};
  // Adjust logic based on your CMP's cookie structure
  if (consent && consent.analytics === true) {
    return 'granted';
  }
  return 'denied';
}
```

### Step 5: Configure Tag Consent Settings

For tags without built-in consent checks, configure consent requirements:

1. Open the tag
2. Go to **Advanced Settings > Consent Settings**
3. Set **Require additional consent for tag to fire**
4. Add the relevant consent types (e.g., `analytics_storage` for GA4)

> **Note**: Google tags (GA4, Google Ads, Floodlight) have built-in consent checks and automatically adjust behavior. Third-party tags (Meta Pixel, TikTok) need manual consent configuration.

---

## Regional Consent Defaults

You may want different defaults for EEA vs rest of world:

```javascript
// Strict defaults for EEA
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  region: [
    'AT',
    'BE',
    'BG',
    'HR',
    'CY',
    'CZ',
    'DK',
    'EE',
    'FI',
    'FR',
    'DE',
    'GR',
    'HU',
    'IE',
    'IT',
    'LV',
    'LT',
    'LU',
    'MT',
    'NL',
    'PL',
    'PT',
    'RO',
    'SK',
    'SI',
    'ES',
    'SE',
    'GB',
    'IS',
    'LI',
    'NO',
  ],
  wait_for_update: 500,
});

// Permissive defaults for rest of world
gtag('consent', 'default', {
  ad_storage: 'granted',
  ad_user_data: 'granted',
  ad_personalization: 'granted',
  analytics_storage: 'granted',
});
```

The more specific regional command takes precedence for users in those regions.

---

## Verification and Debugging

### 1. Tag Assistant

1. Go to [tagassistant.google.com](https://tagassistant.google.com)
2. Connect to your site
3. Look for the **Consent** tab showing consent states
4. Verify states change when interacting with your consent banner

### 2. Network Request Analysis

1. Open Chrome DevTools > Network
2. Filter for `collect` (GA4) or `googleads`
3. Look for the `gcd` parameter in request URLs

The `gcd` parameter encodes consent state. Example: `gcd=13l3l3l3l5`

Each character represents a consent type's state:

- `l` = denied
- `3` = granted by default
- `5` = granted by update

### 3. GA4 DebugView

With [debug mode enabled](/posts/ga4-debug-mode-guide/), check DebugView for consent-related parameters in your events.

### 4. Google Ads Diagnostics

In Google Ads:

1. Go to **Tools > Data Manager**
2. Check **Consent Mode** diagnostics
3. Verify signals are being received from your site

---

## Common Implementation Mistakes

### 1. Consent Default Fires Too Late

**Problem**: Google tags fire before consent defaults are set.

**Symptom**: Consent states show as "not set" in Tag Assistant.

**Fix**: Ensure your consent default tag uses the **Consent Initialization - All Pages** trigger, not regular Page View or Initialization triggers.

### 2. Missing V2 Parameters

**Problem**: Only `ad_storage` and `analytics_storage` are set, missing `ad_user_data` and `ad_personalization`.

**Symptom**: Google Ads shows "Consent Mode not properly configured" warnings.

**Fix**: Add all four parameters to both default and update commands.

### 3. Consent Update Never Fires

**Problem**: Default consent is set but never updated when users accept.

**Symptom**: All users show as denied in reports, even those who accepted.

**Fix**: Verify your CMP fires a dataLayer event on consent, and your update tag triggers on that event.

### 4. Setting Values to `false` Instead of `'denied'`

**Problem**: Using boolean `false` instead of string `'denied'`.

**Symptom**: Unexpected behavior, consent states not recognized.

**Fix**: Always use string values: `'granted'` or `'denied'`.

### 5. Not Testing Consent Persistence

**Problem**: Consent resets on page navigation.

**Symptom**: Users see consent banner on every page, tracking inconsistent.

**Fix**: Verify your CMP stores consent in a persistent cookie and the consent update fires on subsequent page loads if consent was previously granted.

---

## US Considerations

While Consent Mode V2 isn't legally required for US-only operations, implementing it now is strategic:

- **Safari and Firefox** restrict cookies globally, not just in the EU
- **State privacy laws** (California, Virginia, Colorado, etc.) are expanding
- **Future-proofing** avoids scrambling when federal legislation arrives

The implementation effort is the same regardless of geography. Building it now means you're ready when requirements expand.

---

## Checklist

Before going live, verify:

- [ ] Default consent fires on Consent Initialization trigger
- [ ] All four V2 parameters included (ad_storage, analytics_storage, ad_user_data, ad_personalization)
- [ ] Regional defaults set for EEA if applicable
- [ ] Consent update fires when user accepts/rejects
- [ ] Tag Assistant shows correct consent states
- [ ] Google Ads diagnostics show no consent warnings
- [ ] Consent persists across page navigations
- [ ] Privacy policy updated to disclose consent mode usage

---

## Related Resources

- [GA4 Debug Mode: Complete Troubleshooting Guide](/posts/ga4-debug-mode-guide/)
- [Server-Side Tracking Overview](/posts/server-side-tracking-overview/)

---

## Sources

- [Google Developers - Set up consent mode on websites](https://developers.google.com/tag-platform/security/guides/consent)
- [Google Tag Manager Help - Consent mode support](https://support.google.com/tagmanager/answer/10718549)
- [Simo Ahava - Consent Mode V2 For Google Tags](https://www.simoahava.com/analytics/consent-mode-v2-google-tags/)
- [Cookiebot - Implementing Google consent mode](https://support.cookiebot.com/hc/en-us/articles/360016047000-Implementing-Google-consent-mode)
