---
title: "[Case Study] Rebuilding analytics for a multi-domain tourism SPA"
date: 2026-04-11
lang: en
description: Three domains, six advertising platforms, and years of accumulated tracking debt. How I redesigned the data layer, consolidated everything into GTM, and restored reliable conversion data across GA4, Meta, Google Ads, TikTok, LinkedIn, and Microsoft Ads.
---

A large-sized Italian tourism operator running hop-on-hop-off bus tours and experience bookings across three domains came to me with a common problem: their advertising platforms were not receiving reliable conversion data. Meta, LinkedIn, Google Ads, and TikTok dashboards told conflicting stories. Attribution was unreliable. Nobody trusted the numbers.

This is the story of how I rebuilt their analytics infrastructure from the ground up.

## What I found

The three websites, the main brand site, an experience booking platform, and a shore excursion portal, shared a single GTM container but had accumulated tracking code over several years without a coherent plan.

The symptoms were textbook:

- `gtag()` calls hardcoded in the application alongside GTM, causing duplicate events in GA4
- Advertising pixels (Meta, TikTok) loaded both via GTM and directly in the source code
- No structured ecommerce data layer, each platform integration scraped what it needed from the DOM or from scattered `dataLayer.push()` calls with inconsistent schemas
- Cross-domain tracking between the three properties was misconfigured, inflating user counts and breaking session continuity
- Consent mode was either missing or incorrectly implemented, which meant GA4's reporting identity could not enable blended mode, the system lacked the signal quality to model unobserved users

The result: marketing teams could not optimise campaigns because no platform had accurate conversion data. GA4 reports showed inflated direct traffic and broken funnels. The advertising platforms' learning algorithms were training on garbage.

## The approach

The core architectural decision was straightforward: the `dataLayer` becomes the single source of truth. Every piece of tracking data, page views, ecommerce events, user properties, flows through the data layer first. GTM reads from it and distributes to all destinations. Nothing else touches the browser directly.

### Cleaning up the source code

The first deliverable was a document for the development team with two requests:

1. Remove every marketing script loaded directly in the application: `gtag.js`, Meta Pixel, TikTok Pixel, and anything else loaded outside GTM. Only the GTM snippet remains.
2. Prepare DNS infrastructure for server-side GTM: create `data.*` subdomains on all three domains, pointing to a Stape.io endpoint via CNAME records.

This second point was forward-looking. The immediate work was client-side, but the architecture was designed to migrate to server-side GTM without requiring data layer changes.

### Designing the data layer

The sites are Single Page Applications, which adds complexity. Route changes do not trigger full page loads, so `document.referrer` does not update and virtual page views must be explicitly pushed. The data layer specification addressed this with clear rules:

- Clear the `ecommerce` object before every ecommerce push (`dataLayer.push({ ecommerce: null })`)
- Fire `page_view` on every significant route change with dynamically updated `page_location` and `page_title`
- Maintain a custom `page_referrer` variable that tracks the previous SPA route, since the native referrer is unreliable

The ecommerce implementation followed GA4's standard schema but extended it with tourism-specific custom dimensions:

| Parameter                                       | Purpose                                                           |
| ----------------------------------------------- | ----------------------------------------------------------------- |
| `destination_city`                              | City or area of the experience (Rome, Florence, Belfast)          |
| `experience_category`                           | Type of product (Bus Hop On Hop Off, Walking Tour, Museum Ticket) |
| `travel_date`                                   | Selected date for the experience (YYYY-MM-DD)                     |
| `participants_total`                            | Total number of travellers                                        |
| `participants_adults` / `participants_children` | Breakdown by type                                                 |
| `booking_lead_time_days`                        | Days between purchase and travel date                             |
| `payment_method_selected`                       | Payment method at checkout                                        |

These dimensions were not afterthoughts. They were designed to answer specific business questions: which destinations drive the highest revenue per participant? How far in advance do customers book? Does the booking window differ by experience category?

The full ecommerce funnel was specified: `view_item_list` → `view_item` → `add_to_cart` → `begin_checkout` → `add_payment_info` → `purchase`. Each event carried the relevant subset of custom dimensions, and the specification document included working code examples for every step.

### GTM implementation

With the data layer as the foundation, GTM became a distribution hub. The final container includes approximately 50 tags across six platforms:

**GA4**, Full ecommerce funnel, SPA page views with custom referrer handling, custom events (search, lead, login, sign_up, email/phone clicks, link clicks, scroll depth), JavaScript error tracking, and newsletter subscriptions. GA4 config routes through a server container URL for first-party context. Enhanced measurement was partially disabled in favour of manual control, scroll tracking uses custom thresholds, and page views are handled manually due to SPA routing.

**Meta (Facebook)**, Two separate pixels serving two business managers. Full ecommerce funnel (ViewContent, AddToCart, InitiateCheckout, Purchase) plus Search, Lead, CompleteRegistration, and micro-conversions (scroll, phone/email clicks, magazine-to-shop navigation). Advanced matching enabled with user data from checkout forms (email, phone, name, address, postal code, country). Event deduplication via unique event IDs.

**Google Ads**, Conversion Linker configured for cross-domain tracking across all three properties. Purchase conversion with enhanced conversions using manual user-provided data. Ecommerce and lead conversions use a RegEx table for dynamic conversion label mapping. Remarketing audience tag on all pages.

**TikTok**, CompletePayment, AddToCart, InitiateCheckout, ViewContent, AddPaymentInfo, Search, Contact (phone click). Enhanced ecommerce mode enabled where supported.

**LinkedIn**, Insight tag plus individual conversion events: Purchase, Add to Cart, Begin Checkout, Lead, Search (split into ecommerce and magazine search using blocking triggers), Email Click, Phone Click, Scroll 50%, Customize Product.

**Microsoft Ads**, UET tag plus full ecommerce funnel (view_item through purchase) and micro-conversions. Product IDs and values passed for dynamic remarketing.

Some implementation details worth noting:

- **Search event splitting**: The application has two distinct search functions, ecommerce product search and editorial/magazine search. These fire the same underlying `search` event but are split into separate GA4 events (`search` vs `search_magazine`) and separate advertising conversions using blocking triggers that check the page context.

- **XHR listener**: Certain user interactions (affiliate signups) do not push events to the data layer natively. A custom HTML tag intercepts XMLHttpRequest calls to specific API endpoints and synthesises data layer events from the responses.

- **Data transformations**: Each advertising platform expects product data in a different format. GA4 uses the standard `items` array. Meta wants `contents` and `content_ids`. Microsoft Ads needs a flat product ID array. GTM variables handle all transformations from the single canonical data layer structure, the developers never need to think about platform-specific formats.

- **Consent mode**: Implemented via iubenda with default denied state for all purposes (`ad_storage`, `analytics_storage`, `ad_personalization`, `ad_user_data`). URL passthrough enabled for attribution continuity. A 2-second `waitForUpdate` window ensures consent signals reach GTM before tags fire.

## What changed

I do not have precise before/after conversion numbers to share. What I can describe is the structural improvement.

**GA4 reporting identity moved to blended mode.** Before the rebuild, GA4 could not activate blended reporting identity because the signal quality was too low, consent mode was misconfigured, User-ID was not being passed, and Google Signals data was sparse. After implementation, with proper consent mode defaults, User-ID integration on login, and Google Signals enabled, GA4 had enough signal to enable blended mode. This means GA4 can now model behaviour for users who decline analytics cookies, producing more complete (though modelled) metrics.

**Attribution became trustworthy.** The combination of duplicate event removal, proper cross-domain tracking, and correct consent mode implementation means that conversion paths in GA4 now reflect actual user journeys. The inflated direct traffic bucket shrank because sessions were no longer breaking at domain boundaries or being mis-attributed due to missing referrer data in the SPA.

**Advertising platforms received consistent conversion data.** All six platforms now receive the same purchase events, with the same transaction IDs, from the same data source. Enhanced conversions (Google Ads) and advanced matching (Meta) use the same user data object. Event deduplication prevents double-counting. For the first time, the marketing team could compare platform-reported conversions against GA4 with confidence that discrepancies were due to attribution model differences, not data collection errors.

**The architecture is documented and extensible.** The data layer specification serves as the contract between the development team and the analytics implementation. Adding a new advertising platform means adding tags in GTM that read from the existing data layer, no developer work required. The server-side GTM infrastructure is ready for activation when the business decides to proceed.

---

## Takeaways

This was not a complex project in terms of novel technical challenges. It was a cleanup and standardisation job, the kind of work that most analytics implementations need but rarely get. The pattern I see repeatedly is the same: tracking accumulates over years, each addition made by a different person solving an immediate problem, until the whole system becomes unreliable and nobody knows what is actually being measured.

The fix is always architectural before it is technical. Decide where truth lives (the data layer), define the contract (the specification document), clean up everything that violates the contract (hardcoded scripts, duplicate tags), and then build the distribution layer (GTM) on top.

The tourism-specific dimensions were the part that required business understanding rather than just technical competence. Knowing that `booking_lead_time_days` matters for campaign timing, or that participant breakdowns affect revenue-per-head calculations, these decisions determine whether the data infrastructure actually answers business questions or just collects events for the sake of it.
