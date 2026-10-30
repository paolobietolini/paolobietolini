---
title: "GA4 Custom Dimensions & Metrics: When and How to Use Them"
date: 2026-01-03
lang: en
description: GA4 custom dimensions and metrics guide. Learn when to use event-scoped, user-scoped, and item-scoped dimensions, with practical ecommerce examples and GTM implementation.
tags: [ga4]
---

## When Do You Actually Need Custom Dimensions?

GA4 includes dozens of predefined dimensions and metrics. Before creating custom ones, verify your need isn't already covered.

**Don't create custom dimensions for:**

- Transaction ID (already exists as `transaction_id`)
- Page title, URL, path (built-in page dimensions)
- Device category, browser, OS (built-in tech dimensions)
- Traffic source, medium, campaign (built-in acquisition dimensions)

**Do create custom dimensions when:**

- You need business-specific attributes (membership tier, customer segment)
- Your site has unique interactions (quiz answers, configurator selections)
- You track custom product attributes beyond standard ecommerce (subscription type, license tier)
- You need to segment by data not captured by default (logged-in status, A/B test variant)

The rule: **custom dimensions are for custom data**. If GA4 already captures it, you're wasting quota.

---

## Understanding Scopes

GA4 custom dimensions have three scopes. Choosing the wrong scope causes data to appear incorrectly or not at all.

### Event-Scoped

**Applies to**: Single event only

**Use for**: Context that changes with each action

**Examples**:

- Search query entered
- Filter selection applied
- Video title watched
- Form field that failed validation
- Coupon code used at checkout

When a user triggers the event, the dimension value applies only to that event. The next event from the same user won't inherit it.

### User-Scoped (User Properties)

**Applies to**: All future events from that user

**Use for**: Attributes that define the user, not the action

**Examples**:

- Membership tier (free, premium, enterprise)
- Account creation date
- Customer segment (B2B, B2C)
- Subscription status
- CRM customer ID

Once set, user-scoped dimensions persist across sessions until explicitly changed. They're retroactively applied in reports, so historical events from that user will show the dimension value.

> **Important**: User properties only apply to _future_ events after being set. If you set `membership_tier: 'premium'` today, yesterday's events won't show that value.

### Item-Scoped

**Applies to**: Individual products within ecommerce events

**Use for**: Product attributes beyond standard ecommerce fields

**Examples**:

- Product color
- Product size
- Availability status
- Margin tier
- Supplier ID

Item-scoped dimensions only work within the `items` array of ecommerce events (`view_item`, `add_to_cart`, `purchase`, etc.).

> **Limitation**: Item-scoped dimensions are only available in Explorations, not standard reports.

---

## Quota Limits

Plan carefully—once you hit limits, you must wait 48 hours after archiving dimensions before adding new ones.

| Scope                   | Standard GA4 | GA4 360 |
| ----------------------- | ------------ | ------- |
| Event-scoped dimensions | 50           | 125     |
| User-scoped dimensions  | 25           | 100     |
| Item-scoped dimensions  | 10           | 25      |
| Custom metrics          | 50           | 125     |

These limits are **per property**, not per event. A single dimension can receive data from multiple events.

---

## Implementation: Event-Scoped Dimensions

### Step 1: Send the Parameter with Your Event

In GTM, add the parameter to your GA4 Event tag:

1. Open your GA4 Event tag
2. Under **Event Parameters**, click **Add Row**
3. Enter your parameter name and value

**Example**: Tracking search queries

- Parameter Name: `search_term`
- Value: `{{DLV - Search Query}}` (Data Layer Variable)

Or in dataLayer:

```javascript
dataLayer.push({
  event: 'search',
  search_term: 'blue running shoes',
});
```

### Step 2: Register as Custom Dimension in GA4

Parameters aren't automatically available in reports. You must register them:

1. Go to **Admin > Custom definitions > Custom dimensions**
2. Click **Create custom dimension**
3. Enter:
   - **Dimension name**: How it appears in reports (e.g., "Search Term")
   - **Scope**: Event
   - **Event parameter**: The exact parameter name (e.g., `search_term`)
4. Click **Save**

> **Note**: Data appears in reports within 24-48 hours after registration. The dimension won't show historical data from before registration.

---

## Implementation: User-Scoped Dimensions

User-scoped dimensions use a different mechanism: **user properties**.

### Step 1: Set the User Property

**Option A: Via GTM GA4 Configuration Tag**

1. Open your GA4 Configuration tag
2. Under **User Properties**, click **Add Row**
3. Enter property name and value

**Option B: Via dataLayer**

```javascript
dataLayer.push({
  event: 'user_data_ready',
  user_properties: {
    membership_tier: 'premium',
    customer_since: '2023',
  },
});
```

Then in GTM, create a GA4 Event tag that reads these user properties.

**Option C: Via gtag.js directly**

```javascript
gtag('set', 'user_properties', {
  membership_tier: 'premium',
});
```

### Step 2: Register as Custom Dimension

1. Go to **Admin > Custom definitions > Custom dimensions**
2. Click **Create custom dimension**
3. Enter:
   - **Dimension name**: "Membership Tier"
   - **Scope**: User
   - **User property**: `membership_tier`
4. Click **Save**

---

## Implementation: Item-Scoped Dimensions

Item-scoped dimensions capture product attributes within ecommerce events.

### Step 1: Include Parameters in Items Array

Your dataLayer push for ecommerce events must include the custom parameters inside each item:

```javascript
dataLayer.push({
  event: 'view_item',
  ecommerce: {
    items: [
      {
        item_id: 'SKU_12345',
        item_name: 'Running Shoes',
        price: 129.99,
        // Standard parameters above
        // Custom item parameters below
        item_color: 'blue',
        item_size: '42',
        margin_tier: 'high',
      },
    ],
  },
});
```

### Step 2: Register as Custom Dimension

1. Go to **Admin > Custom definitions > Custom dimensions**
2. Click **Create custom dimension**
3. Enter:
   - **Dimension name**: "Product Color"
   - **Scope**: Item
   - **Event parameter**: `item_color`
4. Click **Save**

> **Reminder**: Item-scoped dimensions only appear in **Explorations**, not in standard reports or the real-time view.

---

## Custom Metrics

Custom metrics work similarly to event-scoped dimensions but capture numeric values.

### When to Use Custom Metrics

- Tracking numeric values beyond standard metrics (custom scores, ratings)
- Measuring business-specific quantities (loyalty points earned, credits consumed)
- Aggregating custom calculations

### Implementation

**Step 1**: Send numeric parameter with event

```javascript
dataLayer.push({
  event: 'loyalty_points_earned',
  points_earned: 150,
});
```

**Step 2**: Register in GA4

1. Go to **Admin > Custom definitions > Custom metrics**
2. Click **Create custom metric**
3. Enter:
   - **Metric name**: "Loyalty Points Earned"
   - **Event parameter**: `points_earned`
   - **Unit of measurement**: Standard (or Currency if monetary)
4. Click **Save**

---

## Practical Examples

### Ecommerce: Track Coupon Performance

**Goal**: Understand which coupon codes drive the most revenue

**Implementation**:

```javascript
// In purchase event
dataLayer.push({
  event: 'purchase',
  ecommerce: {
    transaction_id: 'T12345',
    value: 89.99,
    coupon: 'SUMMER20', // Standard parameter
    coupon_type: 'percentage', // Custom parameter
    coupon_source: 'email_campaign', // Custom parameter
  },
});
```

Register `coupon_type` and `coupon_source` as event-scoped custom dimensions.

**Analysis**: In Explorations, create a table with Coupon, Coupon Type, Coupon Source vs. Purchase Revenue to identify which coupon strategies work best.

### B2B: Track Account Attributes

**Goal**: Segment behavior by company size and industry

**Implementation**:

```javascript
// When user logs in or account data is available
gtag('set', 'user_properties', {
  company_size: 'enterprise', // small, mid-market, enterprise
  industry: 'technology',
  contract_tier: 'annual',
});
```

Register as user-scoped custom dimensions.

**Analysis**: Compare conversion rates and engagement metrics across company sizes to identify your ideal customer profile.

### Lead Gen: Track Form Context

**Goal**: Understand which content drives form submissions

**Implementation**:

```javascript
// On form submission
dataLayer.push({
  event: 'generate_lead',
  form_name: 'demo_request',
  content_topic: 'pricing_comparison', // What content they were viewing
  lead_score: 85, // CRM-calculated score
  form_location: 'sidebar', // Where on page
});
```

Register `content_topic`, `lead_score` (as metric), and `form_location` as event-scoped.

**Analysis**: Identify which content topics generate the highest-scoring leads.

### Ecommerce: Track Product Attributes

**Goal**: Analyze color and size preferences

**Implementation**:

```javascript
dataLayer.push({
  event: 'add_to_cart',
  ecommerce: {
    items: [
      {
        item_id: 'SKU_789',
        item_name: 'Classic T-Shirt',
        price: 29.99,
        item_color: 'navy',
        item_size: 'L',
        item_fit: 'regular',
      },
    ],
  },
});
```

Register as item-scoped custom dimensions.

**Analysis**: In Explorations, analyze which colors/sizes have highest add-to-cart rates vs. purchase rates to identify sizing issues.

---

## Common Mistakes

### 1. Duplicating Predefined Dimensions

Creating a custom dimension for `page_title` or `transaction_id` wastes quota. Check [GA4's predefined dimensions](https://support.google.com/analytics/answer/9143382) first.

### 2. Wrong Scope Selection

Using event-scoped when you need user-scoped (or vice versa) causes data to appear incorrectly:

- If membership tier is event-scoped, you only see it for events where you explicitly sent it
- If search query is user-scoped, all future events inherit that value (wrong)

### 3. Parameter Name Mismatch

The parameter name in GA4 registration must **exactly match** what you send in the dataLayer. `searchTerm` ≠ `search_term`.

### 4. Expecting Immediate Data

Custom dimensions take 24-48 hours to populate. Use DebugView to verify parameters are being sent correctly, then wait for reports to populate.

### 5. Not Planning for Quota

Starting with too many dimensions leaves no room for future needs. Audit quarterly and archive dimensions you no longer use.

---

## Verification

### 1. DebugView

Enable [debug mode](/posts/ga4-debug-mode-guide/) and check:

- Event parameters appear in event details
- User properties show in the user properties card

### 2. Realtime Report

Custom dimensions won't appear in realtime, but you can verify the base events are firing.

### 3. Explorations (24-48 Hours Later)

Create a Free-form exploration:

- Add your custom dimension as a row
- Add a metric (Event count, Users)
- Verify data populates

---

## Related Resources

- [GA4 Debug Mode: Complete Troubleshooting Guide](/posts/ga4-debug-mode-guide/)

---

## Sources

- [Google Analytics Help - About custom dimensions and metrics](https://support.google.com/analytics/answer/14240153)
- [Analytics Mania - Guide to Custom Dimensions in GA4](https://www.analyticsmania.com/post/a-guide-to-custom-dimensions-in-google-analytics-4/)
- [Optimize Smart - GA4 Scopes Explained](https://optimizesmart.com/blog/ga4-scopes-user-session-event-item-scopes/)
