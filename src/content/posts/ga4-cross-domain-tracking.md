---
title: "Cross-Domain Tracking in GA4: Setup Without Data Loss"
date: 2026-01-10
lang: en
description: Set up GA4 cross-domain tracking correctly. Complete guide to prevent self-referrals, maintain session continuity, and preserve attribution across multiple domains.
---

## The Problem

When a user clicks from `shop.example.com` to `checkout.example-payments.com`, GA4 treats this as two separate users by default. This causes:

- **Inflated user counts**: One person counted as two (or more) users
- **Broken sessions**: Original session ends, new session begins
- **Self-referrals**: Your first domain shows as traffic source for the second
- **Lost attribution**: The original campaign source disappears

If you spent money on a Google Ad that brought someone to your main site, and they then click to your checkout domain, GA4 reports the checkout traffic source as your main domain—not the paid ad. Your campaign ROI calculations become meaningless.

Cross-domain tracking solves this by passing user identifiers between domains.

---

## When You Need Cross-Domain Tracking

**You need it when:**

- Users navigate between different root domains you own (example.com → example-shop.com)
- You use a third-party checkout on a different domain
- Your funnel spans multiple domains (marketing site → product app → billing)
- You have separate domains for different regions or product lines

**You don't need it for:**

- Subdomains (blog.example.com → shop.example.com)
- Query parameters or path changes on the same domain

> **Note**: GA4 automatically handles subdomains. The tracking cookie is set on the parent domain and works across all subdomains without configuration.

---

## How It Works

When cross-domain tracking is configured:

1. User clicks a link from Domain A to Domain B
2. GA4 appends a `_gl` parameter to the destination URL
3. Domain B reads this parameter and connects the user to their existing session
4. Both page views are attributed to the same user and session

Example URL with linker parameter:

```
https://checkout.example.com/cart?_gl=1*1abc2de*_ga*MTIzNDU2Nzg5*_ga_ABC123*MTYxMjM0NTY3OC4xLjEuMTYxMjM0NTY3OS4w
```

The `_gl` parameter contains encoded cookie values that identify the user.

---

## Setup Method 1: GA4 Admin Interface (Recommended)

The simplest approach uses GA4's built-in configuration—no code changes required.

### Prerequisites

- Same GA4 property (Measurement ID) installed on all domains
- Admin access to the GA4 property

### Configuration Steps

1. Go to **Admin > Data Streams**
2. Select your web data stream
3. Click **Configure tag settings** (at the bottom)
4. Click **Configure your domains**
5. Add all domains that should share user identity:
   - `example.com`
   - `checkout.example-payments.com`
   - `app.example.io`
6. Click **Save**

> **Important**: Include ALL domains in your user journey. Missing even one domain breaks the chain.

GA4 automatically:

- Adds the `_gl` parameter to outbound links to listed domains
- Reads the `_gl` parameter on incoming traffic from listed domains
- Handles referral exclusion so your domains don't show as traffic sources

---

## Setup Method 2: Google Tag Manager

Use GTM when you need more control or when the GA4 admin method isn't sufficient.

### Step 1: Configure Your Google Tag

Open your GA4 Configuration tag (or Google Tag) in GTM.

Under **Configuration Settings**, add:

| Field Name | Value     |
| ---------- | --------- |
| `linker`   | See below |

The linker setting should be an object. In GTM, you can set this using a Custom JavaScript variable that returns:

```javascript
function() {
  return {
    domains: ['example.com', 'checkout.example-payments.com', 'app.example.io'],
    accept_incoming: true
  };
}
```

Or use the **Fields to Set** option with these individual fields:

| Field Name    | Value  |
| ------------- | ------ |
| `allowLinker` | `true` |

And add domains in GA4's admin interface.

### Step 2: Verify on Destination Domain

The destination domain needs to accept the linker parameter. If you've added domains in GA4's admin interface, this is automatic.

If configuring purely through GTM, ensure:

- The same GTM container (or at least the same GA4 property) is on all domains
- `allowLinker` is set to `true` on the destination domain's tag

### Step 3: Publish and Test

Publish your GTM container changes and proceed to testing.

---

## Testing Cross-Domain Tracking

### Test 1: Check for `_gl` Parameter

1. Navigate to your source domain
2. Click a link that goes to your destination domain
3. Check the URL in the browser address bar

**Expected**: URL contains `?_gl=` or `&_gl=` parameter

**If missing**: Cross-domain linking isn't configured or the link type isn't supported (see Limitations).

### Test 2: Verify Cookie Consistency

1. On source domain, open DevTools > Application > Cookies
2. Find the `_ga` cookie and note its value
3. Click through to destination domain
4. Check the `_ga` cookie value on destination domain

**Expected**: Same value on both domains

**If different**: The linker parameter isn't being read correctly

### Test 3: Tag Assistant Verification

1. Open [Tag Assistant](https://tagassistant.google.com/)
2. Connect to your source domain
3. Navigate through your cross-domain flow
4. Check that events appear in a single continuous session

### Test 4: GA4 DebugView

1. Enable [debug mode](/posts/ga4-debug-mode-guide/)
2. Navigate between domains
3. In GA4 DebugView, verify events from both domains appear under the same device

### Test 5: Real-Time and Reports

After 24-48 hours, check:

- **Acquisition reports**: Your own domains shouldn't appear as referral sources
- **User counts**: Should reflect reality, not be inflated by domain transitions

---

## Troubleshooting Common Issues

### Issue 1: Self-Referrals Still Appearing

**Symptoms**: Your domain shows as a traffic source in acquisition reports

**Causes**:

- Domain not added to cross-domain configuration
- Typo in domain name
- Configuration not yet propagated (wait 24-48 hours)

**Solution**:

1. Double-check domain list in GA4 Admin
2. Verify same Measurement ID on all domains
3. Clear browser cookies and retest

### Issue 2: `_gl` Parameter Missing

**Symptoms**: Clicking cross-domain links doesn't add `_gl` to URL

**Causes**:

- Link uses JavaScript navigation instead of `<a>` tag
- Link uses button or form submission
- Domain not in configuration list

**Solutions**:

For JavaScript/button navigation, manually decorate the URL:

```javascript
// Get the linker parameter
const linkerParam = ga.getAll()[0].get('linkerParam');

// Append to destination URL
window.location.href = 'https://checkout.example.com/cart?' + linkerParam;
```

Or use GTM's link decoration for non-standard elements.

### Issue 3: `_gl` Parameter Stripped by Redirects

**Symptoms**: `_gl` appears momentarily then disappears

**Causes**:

- Server-side redirects not preserving query parameters
- JavaScript redirects stripping parameters
- URL rewriting rules removing unknown parameters

**Diagnosis**:

1. Install the [Redirect Path](https://chrome.google.com/webstore/detail/redirect-path) Chrome extension
2. Click your cross-domain link
3. Watch for redirects that strip the `_gl` parameter

**Solution**: Work with your developers to preserve URL parameters through redirects. The redirect logic needs to forward all query parameters, not just known ones.

### Issue 4: Payment Gateway Breaking Sessions

**Symptoms**: Users returning from Stripe/PayPal/etc. show as new sessions

**Causes**:

- Payment gateway domain not in cross-domain config
- Payment gateway strips `_gl` parameter
- Return URL doesn't include linker parameter

**Solutions**:

If you control the payment gateway domain (self-hosted):

- Add it to your cross-domain configuration
- Ensure GA4 is installed with same Measurement ID

If third-party gateway (Stripe Checkout, PayPal):

- Add the gateway domain to your **referral exclusion list** in GA4
- This won't maintain the user ID, but prevents the gateway from appearing as a traffic source

Path: **Admin > Data Streams > Configure tag settings > List unwanted referrals**

Add: `stripe.com`, `paypal.com`, etc.

### Issue 5: Form Submissions Not Working

**Symptoms**: Form POST to another domain doesn't include `_gl`

**Cause**: Cross-domain linking only works for link clicks (`<a>` tags), not form submissions

**Solution**: Decorate the form action URL with the linker parameter:

```javascript
// Before form submission
document.querySelector('form').addEventListener('submit', function (e) {
  const linkerParam = ga.getAll()[0].get('linkerParam');
  this.action = this.action + (this.action.includes('?') ? '&' : '?') + linkerParam;
});
```

### Issue 6: GTM and GA4 Configuration Mismatch

**Symptoms**: Inconsistent behavior across domains

**Cause**: Domains listed in GA4 admin don't match GTM configuration

**Solution**: Pick one source of truth:

- **Recommended**: Configure domains in GA4 admin only, let GTM tags inherit
- If using GTM for domain list, ensure it matches GA4 admin exactly

---

## Handling Multiple Properties

Sometimes you need cross-domain tracking between sites using different GA4 properties (e.g., after an acquisition).

**Challenge**: Cross-domain tracking requires the same Measurement ID on all domains.

**Solutions**:

1. **Consolidate properties**: Move to a single GA4 property for all domains (recommended)

2. **Dual tagging**: Install both Measurement IDs on all domains, but only one handles cross-domain users. This creates duplicate data but maintains cross-domain continuity for one property.

3. **Accept the limitation**: If properties must stay separate, cross-domain tracking won't work. Focus on referral exclusion to at least prevent self-referrals.

---

## Edge Cases

### Domains with Different Cookie Consent

If Domain A has consent granted but Domain B doesn't (user hasn't interacted with consent banner yet), the `_gl` parameter is passed but may not be used until consent is granted on Domain B.

**Solution**: Ensure your consent implementation on Domain B checks for existing linker parameters and honors them once consent is granted.

### iFrames Across Domains

Cross-domain tracking doesn't automatically work for iFrames. The parent page and iframe are isolated contexts.

**Solution**: Post the linker parameter from parent to iframe via `postMessage`, then use it to initialize GA4 in the iframe.

### AMP to Non-AMP

AMP pages have their own GA4 implementation. Cross-domain tracking from AMP to standard pages requires AMP-specific configuration.

**Solution**: Use AMP's linker configuration in your `amp-analytics` component.

---

## Verification Checklist

Before going live, confirm:

- [ ] Same Measurement ID on all domains
- [ ] All domains added to cross-domain configuration
- [ ] `_gl` parameter appears when clicking between domains
- [ ] `_ga` cookie value matches across domains
- [ ] Tag Assistant shows continuous session
- [ ] No self-referrals in acquisition reports (wait 48 hours)
- [ ] Payment gateways added to referral exclusion list
- [ ] Form submissions decorated with linker parameter (if applicable)

---

## Related Resources

- [GA4 Debug Mode: Complete Troubleshooting Guide](/posts/ga4-debug-mode-guide/)
- [Fixing Direct Traffic Inflation in GA4 for SPAs](/posts/fix-direct-traffic-spa/)

---

## Sources

- [Google Analytics Help - Set up cross-domain measurement](https://support.google.com/analytics/answer/10071811)
- [Google Developers - Measure activity across multiple domains](https://developers.google.com/tag-platform/devguides/cross-domain)
- [Analytics Mania - Cross-domain tracking in GA4](https://www.analyticsmania.com/post/cross-domain-tracking-in-google-analytics-4/)
- [Simo Ahava - Cross-domain Tracking In Google Analytics 4](https://www.simoahava.com/gtm-tips/cross-domain-tracking-google-analytics-4/)
