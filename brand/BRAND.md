# Paolo Bietolini: brand guidelines

Identity name: **Braces**, v1 (October 2026).
Personality: technical, minimal, trustworthy.
Audience: freelance clients and fellow engineers and analysts.

This is the reference for anyone, human or AI, building on paolobietolini.com. Tokens live in `tokens.css`. Logo files are in `logo/`. Web assets are in `public/`.

## The symbol

`{ PB }`: the initials written as an object literal, the shape of a `dataLayer.push`.

- Typeface: Geist Mono Medium (500), uppercase.
- **Optical gap**: 0.28em between each brace and the initials. Do not use a full monospace space; it is too wide. Letter-spacing on `PB` is -0.02em.
- In plain text (bios, email signatures, commit messages) write `{ PB }` with normal spaces.
- The logo SVGs are outlined paths and need no font. The HTML version is `.pb-mark` in `tokens.css`:

```html
<a class="pb-mark" href="/" aria-label="Paolo Bietolini, home"><span>{</span><span>PB</span><span>}</span></a>
```

### Lockup

Symbol plus the wordmark "Paolo Bietolini" in Schibsted Grotesk Bold (700), -0.02em tracking. In the horizontal lockup the wordmark cap height is 0.7× the symbol size, with a gap of 0.4× the symbol size.

| File | Use |
|---|---|
| `logo/lockup-horizontal.svg` | Default, on light backgrounds |
| `logo/lockup-horizontal-dark.svg` | On dark backgrounds (`#14121F`) |
| `logo/lockup-horizontal-reversed.svg` | White, on violet `#5B3FD6` |
| `logo/lockup-horizontal-mono.svg` | Single colour ink, for print and stamps |
| `logo/lockup-stacked*.svg` | Square or narrow spaces |
| `logo/symbol*.svg` | Symbol only |

### Size and clear space

- Keep at least one brace width of clear space on every side.
- Full lockup: minimum 120px wide.
- Symbol with braces: minimum 64px. Below 64px, use the initials `PB` alone (favicons).

### Don't

- Stretch, skew or rotate the mark.
- Set it in another typeface.
- Syntax-highlight the braces in different colours.
- Place violet on lavender or any other low-contrast pairing.

## Colour

One accent, two modes. The accent is for the symbol, links and the single primary action on a page. Never use it for body text or large backgrounds; the avatar is the only exception.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--ink` | `#14121F` | `#EEEDF4` | Headings, primary text |
| `--text-2` | `#3E3A50` | `#C9C6D6` | Body text |
| `--muted` | `#5E5A70` | `#9C98B0` | Meta, captions, dates |
| `--paper` | `#FAFAFC` | `#14121F` | Page background |
| `--surface` | `#EFEEF5` | `#1E1B2C` | Cards, code blocks |
| `--rule` | `#E4E2EC` | `#2D2940` | Borders, dividers |
| `--accent` | `#5B3FD6` | `#A493FF` | Symbol, links, primary button |
| `--on-accent` | `#FFFFFF` | `#14121F` | Text on accent |

All text pairings meet WCAG AA. Dark mode follows `prefers-color-scheme` and can be forced with `<html data-theme="dark|light">`. `theme-color` meta is `#14121F` in dark mode and `#FAFAFC` in light mode.

## Typography

- **Schibsted Grotesk** (400, 500, 700): headings, body, wordmark.
- **Geist Mono** (400, 500, 600): the symbol, code, dates, tags and other metadata.

Both are self-hosted (`public/fonts/`, Latin subset, which covers Italian accents). Do not load them from Google; the site promises not to send visitor IPs to third parties.

| Role | Size / line height | Weight | Tracking | Font |
|---|---|---|---|---|
| Display | 56 / 1.05 | 700 | -3% | Sans |
| H1 | 40 / 1.1 | 700 | -2.5% | Sans |
| H2 | 28 / 1.2 | 700 | -2% | Sans |
| H3 | 20 / 1.3 | 500 | 0 | Sans |
| Body | 18 / 1.6 | 400 | 0 | Sans |
| Code | 15 / 1.6 | 400 | 0 | Mono |
| Meta | 13 / 1.4 | 500 | 0 | Mono |

Prose max width: 68ch. Dates use ISO format in mono: `2026-08-03 · C · 8 min`.

## Components (website)

- **Header**: `.pb-mark` + "Paolo Bietolini" (sans 700, 15px) on the left; nav in sans 500, 14px, `--muted`, with "Contact" in `--accent`.
- **Primary button**: `--accent` background, `--on-accent` text, sans 500 14px, padding 10×16px, radius 6px. One per page.
- **Secondary button**: transparent, 1px inset `--rule` border, `--ink` text.
- **Post list item**: meta line (mono, `--muted`) above a title (sans 700, 19–22px), separated from the next item by a 1px `--rule`.
- **Eyebrow**: mono 500, 12–13px, `--accent`, lowercase, items separated by ` · `.
- Radii: 6px controls, 8px cards. No shadows except a 1px `--rule` outline. No gradients.

## Voice

Plain, specific, first person. Explain how things work underneath rather than which button to click. Bilingual: English and Italian, one language per post.

## Web assets (`public/`)

Copy the contents of `brand/public/` into the Astro `public/` folder, then add this to the base layout `<head>`:

```html
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#FAFAFC" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#14121F" media="(prefers-color-scheme: dark)">
<meta property="og:image" content="https://paolobietolini.com/og-default.png">
<meta name="twitter:card" content="summary_large_image">
```

| File | Size | Notes |
|---|---|---|
| `favicon.ico` | 16, 32, 48 | `PB` on violet tile |
| `favicon.svg` | vector | Same as above |
| `apple-touch-icon.png` | 180 | `{ PB }` lavender on ink |
| `icon-192.png`, `icon-512.png` | manifest | `{ PB }` white on violet |
| `og-default.png` | 1200×630 | Default social preview |
| `fonts/*.woff2` | | Self-hosted fonts |

## Social preview (per post)

`og-default.png` is the fallback. Per-post images should use the same layout so they can be generated at build time (for example with Satori in Astro):

- 1200×630, background `#14121F`.
- Top-left at (80, 80): symbol 40px in `#A493FF`, then "Paolo Bietolini" sans 700 30px in `#EEEDF4`.
- Title: sans 700, 76px, -3% tracking, 86px line height, `#EEEDF4`, left 80px, max 3 lines, max width 1040px.
- Bottom-left at baseline 560: `paolobietolini.com` or the post date in mono 500 24px, `#9C98B0`.

## Avatar

`avatar/avatar-violet-800.png` (default for GitHub and LinkedIn) and `avatar/avatar-dark-800.png`. Both are square; platforms crop them to a circle and the mark stays inside the safe area.
