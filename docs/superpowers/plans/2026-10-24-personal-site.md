# paolobietolini.com v1 (home + blog) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Astro starter with a text-first home + blog site styled by the "Braces" brand. Site basics come from `config.yaml` and posts from Markdown.

**Architecture:** Static Astro 7 site with no client JavaScript. Two content collections: `config` (file loader on `config.yaml`) and `posts` (glob loader on `src/content/posts/*.md`). `brand/tokens.css` supplies every visual decision, and `src/styles/site.css` only does layout. Pure helpers in `src/lib/post-utils.ts` are unit-tested with `node --test`. Built output is checked by `node --test` against `dist/`.

**Tech Stack:** Astro 7.4, `@astrojs/sitemap` (existing), `@astrojs/rss` (new), Shiki (built into Astro), Node 24 built-in test runner (native TypeScript stripping, no extra test deps).

**Spec:** `docs/superpowers/specs/2026-10-23-personal-site-design.md`

## Global Constraints

- No client-side JavaScript on any page: no `<script>` in built HTML.
- No new colours, fonts or font sizes outside `brand/tokens.css`. `site.css` uses `var(--…)` tokens for anything visual.
- No shadows, no gradients, no theme toggle. Dark mode follows the OS plus `tokens.css`'s `data-theme` override.
- Fonts are self-hosted from `/fonts/`. No Google Fonts or any third-party request.
- Accent (`--accent`) is used only for `.pb-mark`, links, the eyebrow and the nav item with `accent: true`.
- Meta line format: `YYYY-MM-DD · EN · N min` (mono `.meta`). Reading time is 200 wpm, rounded up, minimum 1.
- Post `lang` is `en | it` and required. `draft` is optional, defaults to `false`, and drafts never reach any built page, list, RSS or sitemap.
- Home shows the 5 newest posts. `/posts/` shows all posts. No pagination.
- Prose max width is `--measure` (68ch). Chrome max width is 720px. Side gutter is 16px.
- Only one dependency is added: `@astrojs/rss`.

## Review Focus

1. **Date off-by-one:** `date: 2026-08-03` is parsed as UTC midnight, and formatting in a local time zone west of UTC prints `2026-08-02`. Format from UTC (`toISOString().slice(0, 10)`). Pinned by `formatDate` unit tests (Task 2).
2. **Drafts leaking:** a draft must not appear on home, `/posts/`, its own URL, `rss.xml` or `sitemap-0.xml`. Pinned by the dist tests in Tasks 2 and 3.
3. **Mobile overflow:** long code lines or long unbroken words must not scroll the whole page sideways at 390px. `pre` scrolls on its own and prose uses `overflow-wrap: anywhere`. Pinned by the Playwright check in Task 4.
4. **Bad front matter or config:** a post with `lang: de`, a missing `lang`, or a misspelt key in `config.yaml` fails the build with a schema error instead of rendering `undefined`. Pinned by a manual build-failure check in Task 2 (step 9) and Zod `.strict()` on the config schema (Task 1).
5. **Fewer than 5 posts / no posts:** home renders without a broken "Latest" section. With zero published posts, it shows "No posts yet." Pinned by `latest()` unit tests (Task 2).

---

## File Structure

| File | Responsibility |
|---|---|
| `config.yaml` | Site basics (`site:` entry) |
| `src/content.config.ts` | Zod schemas plus loaders for `config` and `posts` |
| `src/lib/site.ts` | `getSite(): Promise<Site>` |
| `src/lib/post-utils.ts` | Pure helpers: `formatDate`, `readingTime`, `published`, `latest`, `metaLine` |
| `src/lib/posts.ts` | `getPosts(): Promise<Post[]>` wrapping `getCollection` with `published` |
| `src/layouts/Base.astro` | `<html lang>`, `<head>`, Header, `<main>`, Footer |
| `src/components/Header.astro`, `Footer.astro`, `PostItem.astro` | Chrome and list item |
| `src/pages/index.astro`, `posts/index.astro`, `posts/[slug].astro`, `rss.xml.ts` | Routes |
| `src/styles/site.css` | Layout only |
| `tests/unit/post-utils.test.ts` | Unit tests for the pure helpers |
| `tests/dist/site.test.ts` | Assertions on built `dist/` |

npm scripts (added in Task 1): `"test": "TZ=America/Los_Angeles node --test tests/unit/"` and `"test:dist": "astro build && node --test tests/dist/"`.

---

### Task 1: Brand shell (config, layout, home intro)

**Files:**
- Create: `src/content.config.ts`, `src/lib/site.ts`, `src/layouts/Base.astro`, `src/components/Header.astro`, `src/components/Footer.astro`, `src/styles/site.css`, `tests/dist/site.test.ts`
- Modify: `config.yaml`, `src/pages/index.astro`, `package.json` (scripts)
- Copy: `brand/public/*` → `public/` (overwrite `favicon.ico`, `favicon.svg`)
- Delete: `src/components/Welcome.astro`, `src/assets/astro.svg`, `src/assets/background.svg`, `src/assets/style.css`, `src/layouts/Layout.astro`

**Interfaces:**
- Produces:
  - `type Site = { name: string; tagline: string; description: string; intro: string; nav: { label: string; href: string; accent?: boolean }[]; socials: { label: string; href: string }[] }`
  - `getSite(): Promise<Site>` in `src/lib/site.ts`, which reads `getEntry('config', 'site')` and throws if it's missing.
  - `Base.astro` props: `{ title?: string; description?: string; lang?: 'en' | 'it' }`. The page `<title>` is `${title} · ${site.name}` when `title` is set, else `site.name`. `lang` defaults to `'en'`.
  - `config` collection: `file('config.yaml')` with a `.strict()` Zod object matching `Site`.

- [ ] **Step 1: Write the failing dist test** in `tests/dist/site.test.ts` (read files with `fs.readFileSync('dist/…', 'utf8')`):
  - `home has site name as h1 and tagline eyebrow`: `dist/index.html` contains `<h1` and `Paolo Bietolini`, and contains `digital analytics · martech · measurement`.
  - `home has brand head tags`: contains `rel="manifest"`, `href="/favicon.svg"`, `name="theme-color"` twice, and `<html lang="en"`.
  - `no client script on any page`: every `dist/**/*.html` has no `<script`.
  - `brand fonts are shipped`: `dist/fonts/schibsted-grotesk-latin-700.woff2` exists.
  - `no third-party font hosts`: no `dist/**/*.html` or `dist/**/*.css` contains `fonts.googleapis` or `fonts.gstatic`.
- [ ] **Step 2: Add the npm scripts, run `npm run test:dist`, and expect FAIL** (no h1 or manifest yet).
- [ ] **Step 3: Implement.** Replace `config.yaml` with the spec's `site:` block, keeping the placeholder intro, email and social URLs exactly as written in the spec. Build the schema, `getSite`, `Base` (imports `../../brand/tokens.css` then `../styles/site.css`, plus all `<head>` tags from BRAND.md "Web assets" and a meta description), Header (`.pb-mark` markup from BRAND.md plus the name, sans 700 15px; nav sans 500 14px `--muted`, the `accent` item in `--accent`) and Footer (socials as `.meta` links). Home is the tagline as a `.meta` eyebrow in `--accent`, the name as h1, and the intro split on blank lines into `<p>` in `--text-2`. Copy the brand assets and delete the starter files.
- [ ] **Step 4: Run `npm run test:dist` and expect PASS.** Also run `npx astro check` and expect 0 errors.
- [ ] **Step 5: Commit** `feat: brand shell with config.yaml, layout and home intro`.

### Task 2: Posts (collection, helpers, list, post page)

**Files:**
- Create: `src/lib/post-utils.ts`, `src/lib/posts.ts`, `src/components/PostItem.astro`, `src/pages/posts/index.astro`, `src/pages/posts/[slug].astro`, `src/content/posts/how-a-datalayer-push-becomes-a-hit.md` (en), `src/content/posts/consenso-e-tag-manager.md` (it), `src/content/posts/draft-server-side-tagging.md` (`draft: true`), `tests/unit/post-utils.test.ts`
- Modify: `src/content.config.ts`, `src/pages/index.astro`, `src/styles/site.css`, `tests/dist/site.test.ts`

**Interfaces:**
- Consumes: `Base.astro` props from Task 1.
- Produces (in `src/lib/post-utils.ts`, with no `astro:*` imports so Node can test it):
  - `type PostLike = { id: string; body?: string; data: { title: string; date: Date; lang: 'en' | 'it'; description: string; draft: boolean } }`
  - `formatDate(d: Date): string`, which returns `YYYY-MM-DD` computed in UTC
  - `readingTime(text: string): number`
  - `published<T extends PostLike>(posts: T[]): T[]`, which drops drafts and sorts by date descending (ties broken by `id` ascending)
  - `latest<T>(posts: T[], n = 5): T[]`
  - `metaLine(p: PostLike): string`, for example `2026-08-03 · EN · 8 min`
- `src/lib/posts.ts`: `getPosts(): Promise<CollectionEntry<'posts'>[]>` = `published(await getCollection('posts'))`.
- `posts` schema: `title: string`, `date: z.coerce.date()`, `lang: z.enum(['en','it'])`, `description: string`, `draft: boolean().default(false)`, loader `glob({ pattern: '*.md', base: './src/content/posts' })`. URL slug = entry `id`.

- [ ] **Step 1: Write the failing unit tests** (`node:test` + `node:assert/strict`):
  - `formatDate(new Date('2026-08-03'))` returns `'2026-08-03'`. The `test` script runs with `TZ=America/Los_Angeles`, so a local-time implementation fails here.
  - `readingTime('')` is `1`, 200 words gives `1`, 201 words gives `2`, and `'perché è così'` gives `1` (accented words still count).
  - `published` removes `draft: true`, orders `2026-08-03` before `2026-07-01`, and puts the same-date pair `a` before `b`.
  - `latest` with 3 posts returns 3, with 7 returns the first 5, and with 0 returns `[]`.
  - `metaLine` for an `it` post of 1,600 words dated `2026-08-03` returns `'2026-08-03 · IT · 8 min'`.
- [ ] **Step 2: Run `npm test` and expect FAIL** (module not found).
- [ ] **Step 3: Implement `post-utils.ts`.** `readingTime` counts `text.trim().split(/\s+/).filter(Boolean).length`.
- [ ] **Step 4: Run `npm test` and expect PASS.**
- [ ] **Step 5: Extend the dist tests and expect FAIL:**
  - `post list shows published posts only`: `dist/posts/index.html` contains both published titles and not the draft title.
  - `draft has no page`: `dist/posts/draft-server-side-tagging/` doesn't exist.
  - `italian post sets lang`: `dist/posts/consenso-e-tag-manager/index.html` contains `<html lang="it"`.
  - `post page shows meta line`: the EN post contains `· EN ·` and ` min`.
  - `home lists latest posts`: `dist/index.html` contains both published titles and `href="/posts/"`.
- [ ] **Step 6: Implement.** Add the posts collection. `PostItem` takes props `{ post: CollectionEntry<'posts'> }`: a `.meta` line (`metaLine`) above a sans 700 title link (`clamp(19px, …, 22px)` is allowed as layout sizing within the 19–22px BRAND.md range), with a 1px `--rule` divider. The post list page has h1 "Posts". The post page uses `getStaticPaths` from `getPosts()`, `render(entry)`, `Base` with `lang`, `title` and `description`, and prose inside `.prose { max-width: var(--measure) }`. Home adds h2 "Latest" plus `latest(posts)`, or the text "No posts yet." when empty, followed by an "All posts →" link. `site.css` adds `.prose { overflow-wrap: anywhere }` and `pre { overflow-x: auto; background: var(--surface); border-radius: var(--radius-md); padding: 16px }`. The sample posts get realistic copy of about 300–600 words; the EN one includes a fenced `js` block with one line longer than 100 characters, used in Task 4.
- [ ] **Step 7: Run `npm test && npm run test:dist` and expect PASS.**
- [ ] **Step 8: Commit** `feat: posts collection, list and post pages`.
- [ ] **Step 9: Schema guard (manual, not committed).** Temporarily set `lang: de` in the EN post and run `npx astro build`. Expected: the build fails with a `lang` validation error naming the file. Revert the change, then repeat with an extra key `taglin:` in `config.yaml` and expect a strict-schema error. Revert again.

### Task 3: RSS, code highlighting, head meta

**Files:**
- Create: `src/pages/rss.xml.ts`
- Modify: `package.json` (`npm i @astrojs/rss`), `astro.config.mjs`, `src/layouts/Base.astro`, `src/components/Footer.astro`, `src/styles/site.css`, `tests/dist/site.test.ts`

**Interfaces:**
- Consumes: `getSite()` (Task 1), `getPosts()` (Task 2).
- Produces: `/rss.xml`. `Base.astro` gains `<link rel="alternate" type="application/rss+xml" href="/rss.xml">`, `<link rel="canonical" href={new URL(Astro.url.pathname, Astro.site)}>`, `og:title`, `og:description`, `og:url`, `og:image` = `https://paolobietolini.com/og-default.png`, and `twitter:card` = `summary_large_image`.

- [ ] **Step 1: Extend the dist tests and expect FAIL:**
  - `rss lists published posts`: `dist/rss.xml` starts with `<?xml`, contains exactly 2 `<item>`, and does not contain the draft title.
  - `sitemap excludes draft`: `dist/sitemap-0.xml` contains `/posts/how-a-datalayer-push-becomes-a-hit/` and not `draft-server-side-tagging`.
  - `head meta`: the EN post contains `rel="canonical"`, `og:image`, `summary_large_image` and `application/rss+xml`.
  - `code is dual-theme`: the EN post HTML contains `--shiki-dark`.
- [ ] **Step 2: Implement.** RSS uses `title: site.name`, `description: site.description`, `site: context.site`, and items `{ title, pubDate: date, description, link: /posts/${id}/ }`. In `astro.config.mjs` add `markdown: { shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' } } }`. `site.css` maps `.astro-code, .astro-code span` to `color: var(--shiki-dark); background-color: var(--shiki-dark-bg)` inside the same two dark selectors `tokens.css` uses (`@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) … }` and `:root[data-theme="dark"] …`), and overrides the `pre` background to `var(--surface)` in both modes. The footer gets an RSS link.
- [ ] **Step 3: Run `npm run test:dist` and expect PASS.** Run `npx astro check` and expect 0 errors.
- [ ] **Step 4: Commit** `feat: rss feed, dual-theme code blocks, social meta`.

### Task 4: Visual verification (no commit unless fixes)

**Files:** a throwaway script in the session scratchpad (not committed). It uses Playwright already installed in `.ds-sync/node_modules` (`playwright@1.64.0`, which matches the cached chromium 1248).

- [ ] **Step 1:** Run `npx astro build`, then serve it with `npx astro preview` in the background.
- [ ] **Step 2:** Screenshot `/`, `/posts/` and `/posts/how-a-datalayer-push-becomes-a-hit/` at 1280×800 and 390×844, in `colorScheme: 'light'` and `'dark'` (12 images).
- [ ] **Step 3:** For each page and viewport, assert `document.documentElement.scrollWidth <= window.innerWidth` (Review Focus 3), that `document.fonts` has `Schibsted Grotesk` 700 and `Geist Mono` 500 loaded, and that no request goes to a host other than the preview server.
- [ ] **Step 4:** Look at every screenshot against BRAND.md: accent only on the mark, links, eyebrow and Contact; the meta line is mono and muted; the dark mode palette is correct; and the code block is readable in both modes. Fix any issues in `site.css` or the components, re-run Tasks 2–3's tests, and commit as `fix: <what>`.
- [ ] **Step 5:** Show the user the 390px and 1280px home and post screenshots.
