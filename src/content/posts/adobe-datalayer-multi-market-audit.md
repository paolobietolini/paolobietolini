---
title: "[Case Study] Auditing Adobe Analytics data layers across 8 European markets: what I found"
date: 2026-03-06
lang: en
description: A real-world audit of Adobe Analytics data layers across 8 European markets. Comparing digitalData vs adobeDataLayer, page type taxonomies, product data population, and key takeaways for multi-market implementations.
---

## Why audit a data layer across markets?

If you work on analytics for a brand that operates across multiple countries, you know the challenge: each market was launched at a different time, by a different team, sometimes on a different platform version. Over the years, what was supposed to be a unified tracking setup becomes a patchwork of conventions.

The consequences are real:

- **Cross-market reporting breaks down** when the same page concept gets classified differently
- **Migrations become risky** if you don't know which markets are on which architecture
- **Tag management rules** built for one market silently fail on another
- **Onboarding new analysts** takes longer because there is no single source of truth

I recently audited the Adobe Analytics data layer of a major European grocery retailer across 8 markets: Germany, France, Netherlands, Belgium, Luxembourg, Poland, Spain, and Portugal. The goal was straightforward - document what exists on each page type and identify inconsistencies. What I found is instructive for anyone managing multi-market implementations.

---

## Methodology

The audit covered 6 page types per market, across 8 markets:

1. **Homepage**
2. **Offers/Promotions overview**
3. **Products overview** (the main product catalogue)
4. **Product category page**
5. **Product detail page (PDP)**
6. **Brochure/Leaflet page**

On each page I extracted two objects from the data layer:

- `page.pageCategory` - the page classification object
- `page.pageInfo` - page-level metadata (name, country, language, currency)
- `product[0].productCategory` - the first product's category, when present

The first step was identifying _which_ data layer variable exists. This is not guaranteed to be the same across markets.

```javascript
// Check which data layer variable is available
const available = {};
if (window.digitalData) available.digitalData = true;
if (window.adobeDataLayer) available.adobeDataLayer = true;

// Extract from whichever exists
const dl = window.digitalData || window.adobeDataLayer?.getState?.() || null;

console.log(
  JSON.stringify(
    {
      url: window.location.href,
      pageCategory: dl?.page?.pageCategory,
      pageInfo: dl?.page?.pageInfo,
      firstProduct: dl?.product?.[0]?.productCategory,
    },
    null,
    2
  )
);
```

The key difference: `digitalData` is a plain object you can read directly. `adobeDataLayer` is Adobe's Client Data Layer (ACDL), which requires calling `.getState()` to retrieve the computed state.

---

## Finding #1: two architectures under one brand

The most significant finding is that **not all markets use the same data layer variable**.

| Market | Data Layer Variable     | Access Method |
| ------ | ----------------------- | ------------- |
| DE     | `window.adobeDataLayer` | `.getState()` |
| FR     | `window.adobeDataLayer` | `.getState()` |
| NL     | `window.adobeDataLayer` | `.getState()` |
| BE     | `window.digitalData`    | Direct object |
| LU     | `window.digitalData`    | Direct object |
| PL     | `window.digitalData`    | Direct object |
| ES     | `window.digitalData`    | Direct object |
| PT     | `window.digitalData`    | Direct object |

This split reveals a **platform migration in progress**. The `digitalData` markets use the older W3C-style Customer Experience Digital Data Layer pattern - a static JavaScript object populated at page load. The `adobeDataLayer` markets use Adobe's newer Client Data Layer (ACDL), which is event-driven and designed for AEM (Adobe Experience Manager) Core Components.

### Why this matters

If you're building a unified tag management setup across markets, you need to account for both access patterns. A GTM or Launch rule that reads `digitalData.page.pageCategory.pageType` will work in PL but return `undefined` in FR. You need a normalisation layer:

```javascript
function getDataLayer() {
  if (window.digitalData) return window.digitalData;
  if (window.adobeDataLayer?.getState) return window.adobeDataLayer.getState();
  return null;
}
```

This also tells you something about the organisation: DE, FR and NL are likely on a newer AEM version with ACDL integration, while the other markets haven't migrated yet. If you're planning cross-market standardisation, knowing this split is your starting point.

---

## Finding #2: page type taxonomy diverges

Both architectures populate the same `page.pageCategory` object with the same keys (`pageType`, `primaryCategory`, `subCategory1-3`). But the **values** follow different naming conventions.

### Homepage

| Market             | pageType            |
| ------------------ | ------------------- |
| PL, ES, PT, BE, LU | `Consumer Homepage` |
| DE, FR, NL         | `Homepage:Website`  |

### Offers/promotions overview

| Market         | pageType                       |
| -------------- | ------------------------------ |
| PL, ES, BE, LU | `Promotion Week Overview Page` |
| DE, FR, NL     | `Products:Offer Page:Website`  |

### Products overview

| Market     | pageType                         |
| ---------- | -------------------------------- |
| PL, PT     | `Editorial Overview Page`        |
| BE, LU     | `Enhanced Product Page`          |
| DE, FR, NL | `Products:Product Overview Page` |

### Product detail page

| Market             | pageType               |
| ------------------ | ---------------------- |
| PL, ES, PT, BE, LU | `Product Detail Page`  |
| DE, FR, NL         | `Products:PDP:Website` |

### Brochure / leaflet

| Market     | pageType                   |
| ---------- | -------------------------- |
| PL, LU     | `Editorial Page`           |
| ES         | `Editorial Overview Page`  |
| PT         | `Editorial Page`           |
| BE         | `iPaper Page`              |
| DE, FR, NL | `Leaflet:Leaflet Overview` |

### The pattern

The ACDL markets (DE, FR, NL) use a **colon-delimited hierarchy** in `pageType`: `{Section}:{SubType}:{Platform}`. This is more structured and lends itself to grouping in reports - you can split on `:` to create rollup dimensions.

The legacy markets use **flat, human-readable strings**. These are easier to read but harder to aggregate programmatically. And they're not fully consistent either: the same brochure concept maps to `Editorial Page`, `Editorial Overview Page`, or `iPaper Page` depending on the market.

If you're building cross-market dashboards, you'll need a mapping table to normalise these values. Something like:

```javascript
const PAGE_TYPE_MAP = {
  'Consumer Homepage': 'homepage',
  'Homepage:Website': 'homepage',
  'Promotion Week Overview Page': 'offers',
  'Products:Offer Page:Website': 'offers',
  'Product Detail Page': 'pdp',
  'Products:PDP:Website': 'pdp',
  'Editorial Page': 'content',
  'Editorial Overview Page': 'content',
  'Leaflet:Leaflet Overview': 'leaflet',
  'iPaper Page': 'leaflet',
  // ...
};
```

---

## Finding #3: `siteName` reveals the platform split

A subtle but reliable indicator of which platform group a market belongs to is the `pageInfo.siteName` field:

| Group                   | siteName value                               |
| ----------------------- | -------------------------------------------- |
| Legacy (`digitalData`)  | `"n/a"`                                      |
| ACDL (`adobeDataLayer`) | `"AN {CC} Website"` (e.g. `"AN FR Website"`) |

The `AN` prefix likely stands for the retailer's regional division name. This field is useful for programmatic detection: if `siteName` is `"n/a"`, you know you're on a legacy market and should adjust your extraction logic accordingly.

---

## Finding #4: product data population is inconsistent

One of the more surprising findings is **where** the `product[0].productCategory` object gets populated.

### On PDP pages (expected)

All markets populate product data on PDP pages, but with different approaches:

**Legacy markets** use the actual product taxonomy:

```json
{
  "primaryCategory": "Frescos",
  "subCategory1": "Fruta",
  "subCategory2": "Fruta de temporada"
}
```

**ACDL markets** use a generic classification:

```json
{
  "primaryCategory": "Product Detail",
  "subCategory1": "42-fruits-et-legumes-frais",
  "subCategory2": "n/a"
}
```

Note the difference: legacy markets use human-readable, localised category names. ACDL markets use the string `"Product Detail"` as `primaryCategory` (which is really a page type, not a product category) and slug-based identifiers for the actual category.

### On non-PDP pages (unexpected)

Several markets populate the product array even on pages where you wouldn't expect it:

| Page              | DE  | FR  | NL  | BE  | LU  | PL  | ES  | PT  |
| ----------------- | --- | --- | --- | --- | --- | --- | --- | --- |
| Homepage          | No  | No  | No  | Yes | Yes | Yes | Yes | Yes |
| Offers overview   | Yes | Yes | Yes | Yes | No  | Yes | Yes | -   |
| Products overview | No  | No  | No  | No  | No  | No  | No  | No  |

On the homepage, markets like ES populate `product[0]` with the first visible offer product. This is likely driven by a component that auto-pushes the first rendered product into the data layer - useful for "first product seen" reporting, but potentially misleading if you're counting product impressions.

---

## Finding #5: URL patterns are completely different

PDP URLs follow no shared convention across markets:

| Market | PDP URL pattern                                      | Example                                                                                       |
| ------ | ---------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| DE     | `/produkt/{slug}-{SKU}`                              | `/produkt/erdbeeren-6311.html`                                                                |
| FR     | `/fiches-produits/{slug}-{SKU}`                      | `/fiches-produits/patates-douces-5580.html`                                                   |
| NL     | `/product/{slug}-{SKU}`                              | `/product/goudse-kaas-48-stuk-jong-belegen-1207429.html`                                      |
| BE     | `/nl/p/{slug}-{SKU}.article.html`                    | `/nl/p/spekken-3003000-1-0.article.html`                                                      |
| LU     | `/fr/produits/{cat}/{slug}-{SKU}.article.html`       | `/fr/produits/assortiment-de-paques/guimauves-3003000-1-0.article.html`                       |
| PL     | `/oferty/{week}/{slug}-{SKU}.article.html`           | `/oferty/poniedzialek-sobota-2-7-03/pomidory-malinowe-3791-1-0.article.html`                  |
| ES     | `/ofertas/{week}/{slug}-{SKU}.article.html`          | `/ofertas/desde-2-marzo/fresas-9850-0-0.article.html`                                         |
| PT     | `/produtos/{cat}/{subcat}/{slug}-{SKU}.article.html` | `/produtos/frescos-e-prontos/pizzas-e-refeicoes-prontas/risotto-...-7013098-1-0.article.html` |

This matters if you're building page type detection rules based on URL patterns (common in tag management). A regex like `/\/product\//` would only match NL. You'd need market-specific rules or rely entirely on the data layer's `pageType` value - which, as we've seen, also varies.

The `pageName` field in `pageInfo` is more consistent: all markets follow the pattern `Product Detail:{SKU}:{ProductName}` on PDP pages. This is your most reliable cross-market identifier for product pages.

---

## Finding #6: some page types don't exist everywhere

Not every market has all page types:

- **DE** uses a completely different domain (a regional subdomain) rather than the shared `brand.de` pattern, which is important for cross-domain tracking and URL-based rules.
- **ES** has no dedicated products overview page (`/productos.html` returns a 404). Products are only accessible through the weekly offers.
- **PT** has no separate offers overview - weekly promotions are surfaced through the homepage and brochures.
- **BE** and **LU** use `aanbiedingen-volgende-week` / `offres-de-la-semaine-prochaine` (next week's offers) instead of current week offers. No current-week overview page exists.

If you're building a cross-market content mapping or a site taxonomy, you can't assume page type parity across markets. The data layer will reflect what exists - a `404 Error Page` data layer entry is a valid signal that a page type simply doesn't exist in that market.

---

## Practical takeaways

If you're auditing a multi-market data layer implementation, here's a checklist:

### 1. Identify the data layer variable first

Don't assume `digitalData` or `adobeDataLayer`. Check what exists:

```javascript
const dlVar = window.digitalData ? 'digitalData' : window.adobeDataLayer ? 'adobeDataLayer' : 'unknown';
```

### 2. Build a normalisation layer

Map market-specific `pageType` values to a canonical set. Document this mapping and version-control it.

### 3. Don't trust `primaryCategory` on product objects

In some implementations, `primaryCategory` contains the page type (`"Product Detail"`), not the actual product category. Always validate what each field actually contains.

### 4. Check for product data on non-PDP pages

If `product[0]` is populated on the homepage, it might represent the first rendered offer - not a deliberate page-level classification. Understand the population logic before building segments on it.

### 5. Use `pageName` for cross-market matching

The `Product Detail:{SKU}:{Name}` pattern is the most consistent identifier across all markets. Use it as your anchor for cross-market product page reporting.

### 6. Document missing page types

A `404` in the data layer is data. If a market doesn't have a certain page type, document it explicitly rather than leaving a gap in your reports.

---

## The full dataset

Below is the complete extraction, grouped by market and page type. You can use this as a template for your own multi-market audits.

<details>
<summary>DE - Germany (adobeDataLayer)</summary>

**Homepage** - `pageType: "Homepage:Website"`

```json
{
  "pageCategory": {
    "pageType": "Homepage:Website",
    "primaryCategory": "Home"
  },
  "pageInfo": {
    "pageName": "ConsumerHome",
    "country": "DE",
    "language": "de",
    "currency": "EUR",
    "siteName": "AN DE Website"
  }
}
```

**Offers overview** - `pageType: "Products:Offer Page:Website"`

```json
{
  "pageCategory": {
    "pageType": "Products:Offer Page:Website",
    "primaryCategory": "angebote"
  },
  "firstProduct": {
    "primaryCategory": "Offers",
    "subCategory1": "Angebote"
  }
}
```

**Products overview** - `pageType: "Products:Product Overview Page"`

```json
{
  "pageCategory": {
    "pageType": "Products:Product Overview Page",
    "primaryCategory": "sortiment"
  }
}
```

**Product category (Obst & Gemuese)** - `pageType: "Products:Product Category Page:Assortment"`

```json
{
  "pageCategory": {
    "pageType": "Products:Product Category Page:Assortment",
    "primaryCategory": "sortiment",
    "subCategory1": "obst-gemuese"
  }
}
```

**PDP (Erdbeeren)** - `pageType: "Products:PDP:Website"`

```json
{
  "pageCategory": {
    "pageType": "Products:PDP:Website",
    "primaryCategory": "Produkte",
    "subCategory1": "Angebote",
    "subCategory2": "frisches-obst-gemuese"
  },
  "pageInfo": {
    "pageName": "Product Detail:6311:Erdbeeren"
  },
  "firstProduct": {
    "primaryCategory": "Product Detail",
    "subCategory1": "Angebote",
    "subCategory2": "frisches-obst-gemuese"
  }
}
```

**Brochure** - `pageType: "Leaflet:Leaflet Overview"`

```json
{
  "pageCategory": {
    "pageType": "Leaflet:Leaflet Overview",
    "primaryCategory": "prospekte"
  }
}
```

</details>

<details>
<summary>PL - Poland (digitalData)</summary>

**Homepage**

```json
{
  "pageCategory": {
    "pageType": "Consumer Homepage",
    "primaryCategory": "Home",
    "subCategory1": "n/a",
    "subCategory2": "n/a",
    "subCategory3": "n/a"
  },
  "pageInfo": {
    "pageName": "ConsumerHome",
    "country": "PL",
    "language": "PL",
    "currency": "ZLT",
    "environment": "Production",
    "siteName": "n/a"
  }
}
```

**Offers overview** - `pageType: "Promotion Week Overview Page"`

```json
{
  "pageCategory": {
    "pageType": "Promotion Week Overview Page",
    "primaryCategory": "Oferty",
    "subCategory1": "n/a"
  },
  "pageInfo": {
    "pageName": "Oferty",
    "country": "PL",
    "currency": "ZLT"
  }
}
```

**Products overview** - `pageType: "Editorial Overview Page"`

```json
{
  "pageCategory": {
    "pageType": "Editorial Overview Page",
    "primaryCategory": "Produkty"
  },
  "pageInfo": {
    "pageName": "Produkty"
  }
}
```

**Product category (Pieczywo/Bread)** - `pageType: "Editorial Overview Page"`

```json
{
  "pageCategory": {
    "pageType": "Editorial Overview Page",
    "primaryCategory": "Produkty",
    "subCategory1": "Pieczywo"
  },
  "pageInfo": {
    "pageName": "Pieczywo"
  }
}
```

**PDP** - `pageType: "Product Detail Page"`

```json
{
  "pageCategory": {
    "pageType": "Product Detail Page",
    "primaryCategory": "Oferty",
    "subCategory1": "PONIEDZIAŁEK-SOBOTA 2-7.03",
    "subCategory2": "3791"
  },
  "pageInfo": {
    "pageName": "Product Detail:3791:Pomidory malinowe"
  }
}
```

**Brochure** - `pageType: "Editorial Page"`

```json
{
  "pageCategory": {
    "pageType": "Editorial Page",
    "primaryCategory": "Gazetki"
  },
  "pageInfo": {
    "pageName": "Gazetki"
  }
}
```

</details>

<details>
<summary>FR - France (adobeDataLayer)</summary>

**Homepage** - `pageType: "Homepage:Website"`

```json
{
  "pageCategory": {
    "pageType": "Homepage:Website",
    "primaryCategory": "Home"
  },
  "pageInfo": {
    "pageName": "ConsumerHome",
    "country": "FR",
    "language": "fr",
    "currency": "EUR",
    "siteName": "AN FR Website"
  }
}
```

**Offers overview** - `pageType: "Products:Offer Page:Website"`

```json
{
  "pageCategory": {
    "pageType": "Products:Offer Page:Website",
    "primaryCategory": "offres-et-bons-plans"
  },
  "firstProduct": {
    "primaryCategory": "Offers",
    "subCategory1": "114-asia-green-garden-r",
    "subCategory2": "71-plats-prepares-en-conserve"
  }
}
```

**Products overview** - `pageType: "Products:Product Overview Page"`

```json
{
  "pageCategory": {
    "pageType": "Products:Product Overview Page",
    "primaryCategory": "categories-des-produits"
  }
}
```

**Product category (Viande & Poisson)** - `pageType: "Products:Product Overview Page"`

```json
{
  "pageCategory": {
    "pageType": "Products:Product Overview Page",
    "primaryCategory": "categories-des-produits",
    "subCategory1": "viande-poisson"
  }
}
```

**PDP (Patates douces)** - `pageType: "Products:PDP:Website"`

```json
{
  "pageCategory": {
    "pageType": "Products:PDP:Website",
    "primaryCategory": "Categories Des Produits",
    "subCategory1": "42-fruits-et-legumes-frais"
  },
  "pageInfo": {
    "pageName": "Product Detail:5580:Patates douces"
  },
  "firstProduct": {
    "primaryCategory": "Product Detail",
    "subCategory1": "42-fruits-et-legumes-frais"
  }
}
```

**Brochure** - `pageType: "Leaflet:Leaflet Overview"`

```json
{
  "pageCategory": {
    "pageType": "Leaflet:Leaflet Overview",
    "primaryCategory": "catalogue"
  }
}
```

</details>

<details>
<summary>NL - Netherlands (adobeDataLayer)</summary>

**Homepage** - `pageType: "Homepage:Website"`

```json
{
  "pageInfo": {
    "pageName": "ConsumerHome",
    "country": "NL",
    "language": "nl",
    "currency": "EUR",
    "siteName": "AN NL Website"
  }
}
```

**Offers overview** - `pageType: "Products:Offer Page:Website"`

```json
{
  "pageCategory": {
    "pageType": "Products:Offer Page:Website",
    "primaryCategory": "aanbiedingen"
  },
  "firstProduct": {
    "primaryCategory": "Offers",
    "subCategory1": "vega",
    "subCategory2": "myvay"
  }
}
```

**Products overview** - `pageType: "Products:Product Overview Page"`

```json
{
  "pageCategory": {
    "pageType": "Products:Product Overview Page",
    "primaryCategory": "producten"
  }
}
```

**Product category (Paasassortiment)** - `pageType: "Products:Product Category Page:Assortment"`

```json
{
  "pageCategory": {
    "pageType": "Products:Product Category Page:Assortment",
    "primaryCategory": "producten",
    "subCategory1": "paasassortiment"
  }
}
```

**PDP (Goudse kaas)** - `pageType: "Products:PDP:Website"`

```json
{
  "pageCategory": {
    "pageType": "Products:PDP:Website",
    "primaryCategory": "Producten",
    "subCategory1": "kaas",
    "subCategory2": "molenland"
  },
  "pageInfo": {
    "pageName": "Product Detail:1207429:Goudse kaas 48+ stuk jong belegen"
  },
  "firstProduct": {
    "primaryCategory": "Product Detail",
    "subCategory1": "kaas",
    "subCategory2": "molenland"
  }
}
```

**Brochure** - `pageType: "Leaflet:Leaflet Overview"`

```json
{
  "pageCategory": {
    "pageType": "Leaflet:Leaflet Overview",
    "primaryCategory": "folders"
  }
}
```

</details>

<details>
<summary>ES - Spain (digitalData)</summary>

**Homepage** - `pageType: "Consumer Homepage"`

```json
{
  "pageInfo": {
    "pageName": "ConsumerHome",
    "country": "ES",
    "language": "ES",
    "currency": "EUR"
  },
  "firstProduct": {
    "primaryCategory": "Frescos",
    "subCategory1": "Fruta",
    "subCategory2": "Fruta de temporada"
  }
}
```

**Offers overview** - `pageType: "Promotion Week Overview Page"`

```json
{
  "pageCategory": {
    "pageType": "Promotion Week Overview Page",
    "primaryCategory": "Ofertas"
  },
  "firstProduct": {
    "primaryCategory": "Frescos",
    "subCategory1": "Fruta",
    "subCategory2": "Fruta de temporada"
  }
}
```

**Products overview** - No dedicated page exists (returns 404).

**PDP (Fresas)** - `pageType: "Product Detail Page"`

```json
{
  "pageCategory": {
    "pageType": "Product Detail Page",
    "primaryCategory": "Ofertas",
    "subCategory1": "Desde el 2 de marzo: Ofertas semanales",
    "subCategory2": "9850"
  },
  "pageInfo": {
    "pageName": "Product Detail:9850:Fresas"
  },
  "firstProduct": {
    "primaryCategory": "Frescos",
    "subCategory1": "Fruta",
    "subCategory2": "Fruta de temporada"
  }
}
```

**Brochure** - `pageType: "Editorial Overview Page"`

```json
{
  "pageCategory": {
    "pageType": "Editorial Overview Page",
    "primaryCategory": "Folleto de supermercado"
  }
}
```

</details>

<details>
<summary>PT - Portugal (digitalData)</summary>

**Homepage** - `pageType: "Consumer Homepage"`

```json
{
  "pageInfo": {
    "pageName": "ConsumerHome",
    "country": "PT",
    "language": "PT",
    "currency": "EUR"
  },
  "firstProduct": {
    "primaryCategory": "sem10"
  }
}
```

**Products overview** - `pageType: "Editorial Overview Page"`

```json
{
  "pageCategory": {
    "pageType": "Editorial Overview Page",
    "primaryCategory": "Produtos"
  }
}
```

**Product category (Laticínios)** - `pageType: "Editorial Overview Page"`

```json
{
  "pageCategory": {
    "pageType": "Editorial Overview Page",
    "primaryCategory": "Produtos",
    "subCategory1": "Laticínios"
  }
}
```

**PDP (Risotto com Cogumelos)** - `pageType: "Product Detail Page"`

```json
{
  "pageCategory": {
    "pageType": "Product Detail Page",
    "primaryCategory": "Produtos",
    "subCategory1": "Frescos e Prontos",
    "subCategory2": "Pizzas e Refeições prontas",
    "subCategory3": "7013098"
  },
  "pageInfo": {
    "pageName": "Product Detail:7013098:Risotto com Cogumelos/ Pesto"
  },
  "firstProduct": {
    "primaryCategory": "pizzas-e-refeicoes-prontas"
  }
}
```

**Brochure** - `pageType: "Editorial Page"`

```json
{
  "pageCategory": {
    "pageType": "Editorial Page",
    "primaryCategory": "Folhetos"
  }
}
```

</details>

<details>
<summary>BE - Belgium (digitalData)</summary>

**Homepage** - `pageType: "Consumer Homepage"`

```json
{
  "pageInfo": {
    "pageName": "ConsumerHome",
    "country": "BE",
    "language": "NL",
    "currency": "EUR"
  },
  "firstProduct": {
    "primaryCategory": "Paassnoep"
  }
}
```

**Offers overview** - `pageType: "Promotion Week Overview Page"`

```json
{
  "pageCategory": {
    "pageType": "Promotion Week Overview Page",
    "primaryCategory": "Aanbiedingen van volgende week"
  },
  "firstProduct": {
    "primaryCategory": "AGF-Fruit"
  }
}
```

**Products overview** - `pageType: "Enhanced Product Page"`

```json
{
  "pageCategory": {
    "pageType": "Enhanced Product Page",
    "primaryCategory": "Producten"
  }
}
```

**Product category (Verse producten)** - `pageType: "Editorial Overview Page"`

```json
{
  "pageCategory": {
    "pageType": "Editorial Overview Page",
    "primaryCategory": "Producten",
    "subCategory1": "Verse producten, lage prijzen? Check."
  }
}
```

**PDP (Spekken)** - `pageType: "Product Detail Page"`

```json
{
  "pageCategory": {
    "pageType": "Product Detail Page",
    "primaryCategory": "P",
    "subCategory1": "3003000"
  },
  "pageInfo": {
    "pageName": "Product Detail:3003000:Spekken"
  },
  "firstProduct": {
    "primaryCategory": "Paassnoep"
  }
}
```

**Brochure** - `pageType: "iPaper Page"`

```json
{
  "pageCategory": {
    "pageType": "iPaper Page",
    "primaryCategory": "Onze folders",
    "subCategory1": "Folder van deze week"
  }
}
```

</details>

<details>
<summary>LU - Luxembourg (digitalData)</summary>

**Homepage** - `pageType: "Consumer Homepage"`

```json
{
  "pageInfo": {
    "pageName": "ConsumerHome",
    "country": "LU",
    "language": "FR",
    "currency": "EUR"
  },
  "firstProduct": {
    "primaryCategory": "Paassnoep"
  }
}
```

**Offers overview** - `pageType: "Promotion Week Overview Page"`

```json
{
  "pageCategory": {
    "pageType": "Promotion Week Overview Page",
    "primaryCategory": "Offres de la semaine prochaine"
  }
}
```

**Products overview** - `pageType: "Enhanced Product Page"`

```json
{
  "pageCategory": {
    "pageType": "Enhanced Product Page",
    "primaryCategory": "Produits"
  }
}
```

**Product category (Produits frais)** - `pageType: "Editorial Overview Page"`

```json
{
  "pageCategory": {
    "pageType": "Editorial Overview Page",
    "primaryCategory": "Produits",
    "subCategory1": "Produits frais, prix bas ? Check."
  }
}
```

**PDP (Guimauves)** - `pageType: "Product Detail Page"`

```json
{
  "pageCategory": {
    "pageType": "Product Detail Page",
    "primaryCategory": "Produits",
    "subCategory1": "Assortiment de Pâques",
    "subCategory2": "3003000"
  },
  "pageInfo": {
    "pageName": "Product Detail:3003000:Guimauves"
  },
  "firstProduct": {
    "primaryCategory": "Paassnoep"
  }
}
```

**Brochure** - `pageType: "Editorial Page"`

```json
{
  "pageCategory": {
    "pageType": "Editorial Page",
    "primaryCategory": "Nos dépliants"
  }
}
```

</details>

---

## Conclusion

A multi-market data layer audit isn't glamorous work, but it reveals truths that no documentation will tell you. In this case, the audit surfaced a platform split (legacy vs. ACDL), taxonomy inconsistencies, unexpected product data on non-product pages, and missing page types - all of which would cause problems in a cross-market reporting setup.

The data layer is the foundation of your analytics stack. If the foundation is inconsistent, everything built on top of it - reports, segments, attribution models - inherits that inconsistency. An audit like this takes a few hours and saves you from months of misattributed data.

If you're managing a similar multi-market setup, start with the checklist above. And if your `pageType` values don't match across markets, at least now you know you're not alone.
