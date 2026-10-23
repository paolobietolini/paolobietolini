# paolobietolini.com v1: home + blog

Date: 2026-10-23 · Status: draft for review

## Goal

A small, fast, text-first personal site in the spirit of Filippo Valsorda's: a short intro on the home page and a blog. It uses the "Braces" brand (`brand/BRAND.md`, `brand/tokens.css`) as is. Site basics live in one `config.yaml`. Posts are Markdown files.

**Success means:**
- `astro build` passes with no warnings about content or config.
- Home, post list and a post page look on-brand in light and dark mode (checked with Playwright screenshots).
- The pages ship no client-side JavaScript.
- Adding a post means adding one `.md` file. Changing the intro or links means editing `config.yaml`.

**Out of scope for v1:** services or landing page, a translated UI or `/it/` routes, tags pages, search, MDX, comments, analytics, per-post generated OG images (`og-default.png` is used for every page).

## Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| Scope | Home + blog |
| YAML config | Site basics only: name, tagline, intro, nav, socials |
| Languages | One mixed post list. Each post declares `lang: en \| it`, which shows in its meta line and sets `<html lang>` on the post page. The UI is in English. |
| Approach | Plain Astro (7.4), hand-built. No template, no CSS framework, no MDX. |

## Structure

```
config.yaml                 site basics (see below)
public/                     brand/public/* copied in (fonts/, favicons, icons, og-default.png, site.webmanifest)
src/
  content.config.ts         collections: `posts` (glob loader, Markdown) and `config` (file loader, config.yaml)
  content/posts/*.md        one file per post
  layouts/Base.astro        <html lang>, <head>, Header, <main>, Footer
  components/Header.astro   .pb-mark + "Paolo Bietolini" left, nav right
  components/Footer.astro   socials + RSS link, mono .meta style
  components/PostItem.astro meta line + title link
  lib/site.ts               getSite(): reads the `config` entry, returns typed site data
  lib/posts.ts              getPosts(): non-draft posts sorted by date desc; readingTime()
  pages/index.astro         intro + latest 5 posts + "All posts →"
  pages/posts/index.astro   all posts
  pages/posts/[slug].astro  one post
  pages/rss.xml.ts          RSS via @astrojs/rss
  pages/robots.txt.ts       existing, kept
  styles/site.css           layout only
```

To remove: `src/components/Welcome.astro`, `src/assets/astro.svg`, `src/assets/background.svg`, `src/assets/style.css`, `src/layouts/Layout.astro` (replaced by `Base.astro`), the starter `public/favicon.*`.

## config.yaml

The top-level `site` key becomes the single entry (`id: "site"`) of the `config` collection. A Zod schema in `content.config.ts` validates it, so a typo fails the build.

```yaml
site:
  name: Paolo Bietolini
  tagline: digital analytics · martech · measurement
  description: Freelance digital analytics and MarTech engineer.   # <meta description>, RSS
  intro: |
    I'm Paolo. I build tracking, tag management and measurement setups,
    and write about how they work underneath.
  nav:
    - { label: Posts, href: /posts/ }
    - { label: Contact, href: "mailto:hello@paolobietolini.com", accent: true }
  socials:
    - { label: GitHub, href: https://github.com/… }
    - { label: LinkedIn, href: https://www.linkedin.com/in/… }
```

The intro copy, email and social URLs above are placeholders that Paolo fills in. `intro` is plain text with paragraphs separated by blank lines. No Markdown is rendered from YAML in v1.

## Post front matter

```yaml
---
title: How a dataLayer push becomes a hit
date: 2026-08-03
lang: en            # en | it, required
description: One sentence for the list page, RSS and <meta>.
draft: false        # optional, default false; drafts are excluded from build output
---
```

- The slug is the filename (`src/content/posts/datalayer-push.md` → `/posts/datalayer-push/`).
- Reading time is computed from the word count at 200 words per minute, rounded up, with a minimum of 1.
- The meta line uses the format from BRAND.md: `2026-08-03 · EN · 8 min` (mono, `.meta`).

## Pages

**Home (`/`):** header; the tagline as a mono accent eyebrow; `name` as the H1; intro paragraphs in `--text-2`; a "Latest" heading followed by the 5 newest posts (`PostItem`); a link to "All posts →".

**Posts (`/posts/`):** an H1 "Posts", then every post as a `PostItem`. No pagination in v1.

**Post (`/posts/<slug>/`):** the meta line, an H1 title, then the rendered Markdown. Prose is capped at `--measure` (68ch). `<html lang>` comes from the post's `lang`. Code blocks use Astro's Shiki with a theme that works in both colour modes (`shikiConfig.themes: { light: github-light, dark: github-dark }`; `site.css` switches spans to `--shiki-dark` under the same two dark-mode selectors `tokens.css` uses). Their background is `--surface` with an 8px radius.

**RSS (`/rss.xml`):** all non-draft posts with title, date, description and link. It's linked from the footer and from `<link rel="alternate">`.

## Layout and styling

- `Base.astro` imports `brand/tokens.css` once. That file supplies the colours, type, the dark mode (`prefers-color-scheme` plus the `data-theme` override) and the `.pb-mark` and `.meta` classes.
- `site.css` adds layout only: a centred column (max-width about 720px for chrome, `--measure` for prose, 16px side gutter), header flex row, post list dividers (1px `--rule`) and footer spacing. It defines no new colours, fonts or sizes; anything visual uses tokens.
- The header follows BRAND.md: `.pb-mark` plus the name (sans 700, 15px) on the left; nav in sans 500 14px `--muted`, with the `accent: true` item in `--accent`.
- No shadows, no gradients, no JavaScript and no theme toggle in v1 (the theme follows the OS).
- `<head>`: title (`<post title> · <site name>` or the site name alone), meta description, the favicon/manifest/theme-color tags from BRAND.md, OG and Twitter tags with `og-default.png`, canonical URL and the RSS alternate link.

## Dependencies

- Add `@astrojs/rss`.
- Keep `@astrojs/sitemap` and `astro.config.mjs` as they are (`site` is already set). Add `markdown.shikiConfig` for the dual theme.

## Verification

1. `npx astro check` and `npx astro build` pass.
2. Two sample posts (one EN, one IT) plus one draft, to confirm the draft is excluded from `/posts/`, home and RSS.
3. Playwright screenshots of `/`, `/posts/` and one post at 1280px and 390px wide, in light and dark (`emulateMedia colorScheme`). Check them against BRAND.md: fonts load, accent used only for the mark, links and Contact, no horizontal scroll on mobile.
4. `dist/` contains no `<script>` tags on content pages.
5. `rss.xml` validates (well-formed, contains the 2 published posts).

## Open points for Paolo

- Real intro text, contact email and social URLs (placeholders until provided).
- Whether the sample posts should stay as real content or be deleted before launch.
