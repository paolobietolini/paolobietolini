# Paolo Bietolini · "Braces" brand (v1): how to build with it

This is a **tokens-only** design system. It has no React components. You build with plain HTML/JSX that is styled through CSS custom properties, element defaults and two helper classes. Everything comes from `styles.css` (it imports `fonts/fonts.css` + `_ds_bundle.css`). Read `_ds_bundle.css` for the full token list and `guidelines/brand/BRAND.md` for the brand rules before you style anything.

## Setup

- Load `styles.css` and nothing else. It self-hosts **Schibsted Grotesk** (400/500/700) and **Geist Mono** (400/500/600). Never load fonts from Google or any other CDN.
- `html` and `body` already get `--paper` background, `--ink` text, the sans font and the 18px/1.6 body size. Plain `h1`–`h3`, `p`, `a`, `code`, `hr` and `::selection` are pre-styled, so use semantic elements and don't restyle them.
- Light/dark follows `prefers-color-scheme`. Force a mode with `<html data-theme="dark">` or `data-theme="light"`. Every colour token flips automatically, so never hard-code hex values.

## Tokens (use `var(--name)`)

| Family | Names |
|---|---|
| Colour | `--ink` (headings, primary text), `--text-2` (body), `--muted` (meta, captions), `--paper` (page bg), `--surface` (cards, code blocks), `--rule` (borders, dividers), `--accent` (logo, links, the ONE primary button), `--on-accent` (text on accent) |
| Font | `--font-sans`, `--font-mono` |
| Size | `--fs-display` 56, `--fs-h1` 40, `--fs-h2` 28, `--fs-h3` 20, `--fs-body` 18, `--fs-code` 15, `--fs-meta` 13 |
| Line height | `--lh-display`, `--lh-h1`, `--lh-h2`, `--lh-h3`, `--lh-body` |
| Tracking | `--tracking-display`, `--tracking-h1`, `--tracking-h2` |
| Shape | `--radius-sm` 6px (buttons, inputs), `--radius-md` 8px (cards), `--radius-lg` 10px, `--measure` 68ch (prose max width), `--brace-gap` |

## Classes

- `.pb-mark`: the text logo. The markup must be exactly `<a class="pb-mark" href="/" aria-label="Paolo Bietolini, home"><span>{</span><span>PB</span><span>}</span></a>`. Set its size with `font-size` only. Never recolour the braces separately.
- `.meta`: mono 13px, weight 500, `--muted`. Use it for dates (ISO: `2026-08-03 · 8 min`), tags and captions.

## Rules the agent must follow

- `--accent` is for the logo, links and **at most one** primary action per page. Never use it for body text or large backgrounds.
- No shadows (use a 1px `--rule` border instead) and no gradients. Radii are 6px on controls and 8px on cards.
- Primary button: `--accent` bg, `--on-accent` text, sans 500 14px, padding 10px 16px, `--radius-sm`. Secondary button: transparent with a 1px `--rule` border and `--ink` text.
- Eyebrow: mono 500 12–13px, `--accent`, lowercase, items separated by ` · `.
- Post list item: a `.meta` line above a sans 700 title (19–22px), with a 1px `--rule` divider between items.
- Voice: plain, specific, first person. Explain how things work underneath.

## Example

```jsx
<main style={{ maxWidth: "var(--measure)", margin: "0 auto", padding: "48px 16px" }}>
  <a className="pb-mark" href="/" aria-label="Paolo Bietolini, home" style={{ fontSize: 32 }}>
    <span>{"{"}</span><span>PB</span><span>{"}"}</span>
  </a>
  <p className="meta" style={{ color: "var(--accent)" }}>digital analytics · martech · measurement</p>
  <h1>Digital analytics, MarTech, and measurement.</h1>
  <p style={{ color: "var(--text-2)" }}>How a dataLayer push becomes a hit, step by step.</p>
  <article style={{ background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: "var(--radius-md)", padding: 24 }}>
    <p className="meta">2026-08-03 · 8 min</p>
    <h3>Server-side tagging, without the magic</h3>
  </article>
  <button style={{ background: "var(--accent)", color: "var(--on-accent)", border: 0, borderRadius: "var(--radius-sm)", padding: "10px 16px", font: "500 14px var(--font-sans)" }}>Get in touch</button>
</main>
```
