import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { tagSlug } from '../../src/lib/post-utils.ts';

const DIST = 'dist';
const read = (p: string) => readFileSync(join(DIST, p), 'utf8');
const files = (ext: string) =>
  readdirSync(DIST, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith(ext));

test('home has site name as h1 and tagline eyebrow', () => {
  const html = read('index.html');
  assert.match(html, /<h1[^>]*>Paolo Bietolini<\/h1>/);
  assert.ok(html.includes('digital analytics · martech · measurement'));
});

test('home has brand head tags', () => {
  const html = read('index.html');
  assert.ok(html.includes('rel="manifest"'));
  assert.ok(html.includes('href="/favicon.svg"'));
  assert.equal(html.match(/name="theme-color"/g)?.length, 2);
  assert.ok(html.includes('<html lang="en"'));
});

// The live server sends CSP `script-src 'self'`: inline scripts are blocked, so every
// executable script must be a same-origin file. JSON-LD is data, not script.
// Allowed: the blocking theme script and the relayer, bundled by Astro into /_astro/.
test('scripts are JSON-LD, the theme script or the bundled relayer (CSP script-src self)', () => {
  for (const f of files('.html')) {
    const scripts = [...read(f).matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
    for (const [, attrs, body] of scripts) {
      if (attrs.includes('type="application/ld+json"')) continue;
      const ok = /src="\/theme\.js"/.test(attrs) || /type="module"[^>]*src="\/_astro\/[^"]+\.js"|src="\/_astro\/[^"]+\.js"[^>]*type="module"/.test(attrs);
      assert.ok(ok, `${f}: unexpected script <script${attrs}>`);
      assert.equal(body.trim(), '', `${f}: inline code in <script${attrs}>`);
    }
    assert.equal(scripts.filter(([, a]) => a.includes('src="/theme.js"')).length, 1, f);
  }
});

test('every page loads the relayer bundle', () => {
  for (const f of files('.html')) {
    const srcs = [...read(f).matchAll(/<script type="module"[^>]*src="(\/_astro\/[^"]+\.js)"/g)].map((m) => m[1]);
    assert.ok(srcs.some((src) => read(src.slice(1)).includes('relayer:change')), `${f}: no relayer bundle`);
  }
});

test('theme script loads before stylesheets', () => {
  const head = read('index.html').split('</head>')[0];
  const theme = head.indexOf('src="/theme.js"');
  const css = [head.indexOf('rel="stylesheet"'), head.indexOf('<style')].filter((i) => i >= 0);
  assert.ok(theme >= 0, 'no theme script');
  assert.ok(css.every((i) => theme < i), 'theme script after CSS');
});

test('theme script guards storage and exposes state', () => {
  const js = read('theme.js');
  assert.ok(js.includes('try') && js.includes('localStorage'));
  assert.ok(js.includes('aria-pressed'));
});

test('every page has a theme toggle that exposes its state', () => {
  for (const f of files('.html')) {
    const btn = read(f).match(/<button[^>]*data-theme-toggle[^>]*>/)?.[0] ?? '';
    assert.ok(btn.includes('aria-label="Dark theme"'), f);
    assert.match(btn, /aria-pressed="(true|false)"/, f);
  }
});

test('header links to tags', () => {
  assert.ok(read('index.html').includes('href="/tags/"'));
});

const jsonLd = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

test('brand fonts are shipped', () => {
  assert.ok(existsSync(join(DIST, 'fonts/schibsted-grotesk-latin-700.woff2')));
});

test('no third-party font hosts', () => {
  for (const f of [...files('.html'), ...files('.css')]) {
    assert.ok(!/fonts\.(googleapis|gstatic)/.test(read(f)), f);
  }
});

// Post expectations come from the real content, so the tests follow whatever posts exist.
const SRC = 'src/content/posts';
const POSTS = readdirSync(SRC)
  .filter((f) => f.endsWith('.md'))
  .map((f) => {
    const fm = parseYaml(readFileSync(join(SRC, f), 'utf8').split(/^---$/m)[1]);
    return {
      file: f,
      title: String(fm.title),
      lang: fm.lang as string,
      draft: fm.draft === true,
      description: String(fm.description),
      tags: (fm.tags ?? []) as string[],
      featured: fm.featured === true,
    };
  });
const PUBLISHED = POSTS.filter((p) => !p.draft);
const DRAFTS = POSTS.filter((p) => p.draft);
const decode = (s: string) =>
  s.replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const postPages = () => readdirSync(join(DIST, 'posts')).filter((d) => existsSync(join(DIST, 'posts', d, 'index.html')));
const builtTitle = (html: string) => decode(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)![1].trim());

test('post list shows every published post and no drafts', () => {
  const html = decode(read('posts/index.html'));
  for (const p of PUBLISHED) assert.ok(html.includes(p.title), p.title);
  for (const p of DRAFTS) assert.ok(!html.includes(p.title), p.title);
});

test('one page per published post, none for drafts', () => {
  assert.equal(postPages().length, PUBLISHED.length);
});

test('each post page sets its lang and shows the meta line', () => {
  const byTitle = new Map(PUBLISHED.map((p) => [p.title, p]));
  for (const d of postPages()) {
    const html = read(`posts/${d}/index.html`);
    const post = byTitle.get(builtTitle(html));
    assert.ok(post, `no source post for ${d}`);
    assert.ok(html.includes(`<html lang="${post.lang}"`), d);
    assert.ok(html.includes(`· ${post.lang.toUpperCase()} ·`), d);
  }
});

test('home lists the latest posts', () => {
  const html = read('index.html');
  assert.equal(html.match(/class="post-item"/g)?.length ?? 0, Math.min(5, PUBLISHED.length));
  assert.ok(html.includes('href="/posts/"'));
});

test('rss lists published posts only', () => {
  const xml = read('rss.xml');
  assert.ok(xml.startsWith('<?xml'));
  assert.equal(xml.match(/<item>/g)?.length ?? 0, PUBLISHED.length);
  for (const p of DRAFTS) assert.ok(!xml.includes(p.title), p.title);
});

test('sitemap lists every post page', () => {
  const xml = read('sitemap-0.xml');
  for (const d of postPages()) assert.ok(xml.includes(`/posts/${d}/`), d);
  assert.equal(xml.match(/\/posts\/[^<]+\/</g)?.length ?? 0, PUBLISHED.length);
});

test('head meta', () => {
  const html = read(`posts/${postPages()[0]}/index.html`);
  for (const s of ['rel="canonical"', 'og:image', 'summary_large_image', 'application/rss+xml']) {
    assert.ok(html.includes(s), s);
  }
});

test('code is dual-theme', () => {
  const withCode = postPages().map((d) => read(`posts/${d}/index.html`)).filter((h) => h.includes('astro-code'));
  assert.ok(withCode.length > 0, 'no post has a code block');
  for (const html of withCode) assert.ok(html.includes('--shiki-dark'));
});

test('no embedded third-party frames', () => {
  for (const f of files('.html')) assert.ok(!read(f).includes('<iframe'), f);
});

test('each post page has exactly one h1', () => {
  for (const d of postPages()) {
    assert.equal(read(`posts/${d}/index.html`).match(/<h1[\s>]/g)?.length, 1, d);
  }
});

test('home has WebSite and Person JSON-LD', () => {
  const [data] = jsonLd(read('index.html'));
  const types = data['@graph'].map((n: { '@type': string }) => n['@type']);
  assert.deepEqual(types.sort(), ['Person', 'WebSite']);
});

test('each post page has article JSON-LD and its own OG image', () => {
  const byTitle = new Map(PUBLISHED.map((p) => [p.title, p]));
  for (const d of postPages()) {
    const html = read(`posts/${d}/index.html`);
    const post = byTitle.get(builtTitle(html))!;
    const ld = jsonLd(html);
    assert.equal(ld.length, 1, d);
    const [a] = ld;
    assert.deepEqual(a['@type'], ['BlogPosting', 'TechArticle'], d);
    assert.equal(a.headline, post.title, d);
    assert.equal(a.inLanguage, post.lang, d);
    // Google requires full ISO 8601 datetimes with a timezone.
    const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/;
    assert.match(a.datePublished, iso, d);
    if (a.dateModified) assert.match(a.dateModified, iso, d);
    assert.equal(a.image, `https://paolobietolini.com/og/${d}.png`, d);
    assert.ok(html.includes(`property="og:image" content="${a.image}"`), d);
    const png = readFileSync(join(DIST, 'og', `${d}.png`));
    assert.equal(png.readUInt32BE(16), 1200, d);
    assert.equal(png.readUInt32BE(20), 630, d);
  }
});

const TAG_SLUGS = [...new Set(PUBLISHED.flatMap((p) => p.tags.map(tagSlug)))];

test('tags index links every tag', () => {
  const html = read('tags/index.html');
  for (const slug of TAG_SLUGS) assert.ok(html.includes(`href="/tags/${slug}/"`), slug);
});

test('each tag page lists exactly its posts', () => {
  for (const slug of TAG_SLUGS) {
    const html = read(`tags/${slug}/index.html`);
    const expected = PUBLISHED.filter((p) => p.tags.some((t) => tagSlug(t) === slug)).length;
    assert.equal(html.match(/class="post-item"/g)?.length ?? 0, expected, slug);
    assert.equal(html.match(/<h1[\s>]/g)?.length, 1, slug);
  }
});

test('posts index links to tags', () => {
  const html = read('posts/index.html');
  const row = html.match(/<nav class="tag-filter"[\s\S]*?<\/nav>/);
  assert.ok(row, 'no tag filter row');
  assert.ok(row[0].includes('href="/tags/"'));
});

const htmlLang = (html: string) => html.match(/<html lang="([a-z]+)"/)![1];
const articleOf = (html: string) => html.match(/class="prose-body"[^>]*>([\s\S]*?)<footer class="post-footer"/)?.[1] ?? '';

test('post nav stays in the post language', () => {
  let links = 0;
  for (const d of postPages()) {
    const html = read(`posts/${d}/index.html`);
    for (const m of html.matchAll(/<a[^>]*rel="(?:prev|next)"[^>]*href="\/posts\/([^/]+)\/"|<a[^>]*href="\/posts\/([^/]+)\/"[^>]*rel="(?:prev|next)"/g)) {
      const target = decodeURIComponent(m[1] ?? m[2]);
      assert.equal(htmlLang(read(`posts/${target}/index.html`)), htmlLang(html), `${d} → ${target}`);
      links++;
    }
  }
  assert.ok(links > 0, 'no post nav links at all');
});

test('posts with 2+ headings have a table of contents', () => {
  for (const d of postPages()) {
    const html = read(`posts/${d}/index.html`);
    const body = articleOf(html);
    assert.ok(body, `${d}: no prose-body`);
    const n = body.match(/<h[234][\s>]/g)?.length ?? 0;
    assert.equal(html.includes('class="toc'), n >= 2, `${d}: ${n} headings`);
  }
});

test('italian posts use italian labels', () => {
  const pages = postPages().map((d) => read(`posts/${d}/index.html`));
  const it = pages.filter((h) => htmlLang(h) === 'it' && h.includes('class="toc'));
  assert.ok(it.length > 0, 'no italian post with a toc');
  for (const h of it) assert.ok(h.includes('Indice') && !h.includes('>Contents<'));
});

test('post header shows the description', () => {
  const byTitle = new Map(PUBLISHED.map((p) => [p.title, p]));
  for (const d of postPages()) {
    const html = read(`posts/${d}/index.html`);
    const post = byTitle.get(builtTitle(html))!;
    const sub = html.match(/<p class="post-subtitle"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? '';
    assert.equal(decode(sub).trim(), post.description, d);
  }
});

test('home has facts, about and contact', () => {
  const html = read('index.html');
  for (const s of ['<dl class="facts"', 'id="about"', 'id="contact"', 'href="mailto:hello@paolobietolini.com"']) {
    assert.ok(html.includes(s), s);
  }
});

test('home shows featured posts', () => {
  const html = read('index.html');
  const expected = Math.min(4, PUBLISHED.filter((p) => p.featured).length);
  assert.equal(html.match(/class="featured-card"/g)?.length ?? 0, expected);
});

test('at most one primary button per page', () => {
  for (const f of files('.html')) assert.ok((read(f).match(/class="btn-primary/g)?.length ?? 0) <= 1, f);
  assert.equal(read('index.html').match(/class="btn-primary/g)?.length, 1);
});

test('hero art is decorative and motion-safe', () => {
  const html = read('index.html');
  assert.match(html, /<svg[^>]*class="hero-art"[^>]*aria-hidden="true"|<svg[^>]*aria-hidden="true"[^>]*class="hero-art"/);
  assert.ok(files('.css').some((f) => read(f).includes('prefers-reduced-motion')));
});

test('forced theme also sets color-scheme, so scrollbars and controls match', () => {
  const css = files('.css').map(read).join('\n').replace(/[\s"']+/g, '');
  assert.ok(css.includes(':root[data-theme=dark]{color-scheme:dark}'), 'dark');
  assert.ok(css.includes(':root[data-theme=light]{color-scheme:light}'), 'light');
});

test('images inside posts never exceed the text column', () => {
  const css = files('.css').map(read).join('\n').replace(/\s+/g, '');
  assert.match(css, /\.proseimg\{[^}]*max-width:100%/);
});

const builtCss = () => files('.css').map(read).join('\n').replace(/\s+/g, '');

test('no shadows in site CSS (brand rule)', () => {
  assert.ok(!builtCss().includes('box-shadow'));
});

test('chips wrap instead of widening the page', () => {
  const chip = builtCss().match(/\.chip\{[^}]*\}/)![0];
  assert.ok(!chip.includes('white-space:nowrap'), chip);
  assert.ok(chip.includes('overflow-wrap:anywhere'), chip);
});

test('theme toggle icons are 24px (spec)', () => {
  const btn = read('index.html').match(/<button[^>]*data-theme-toggle[\s\S]*?<\/button>/)![0];
  const svgs = btn.match(/<svg[^>]*>/g) ?? [];
  assert.equal(svgs.length, 2);
  for (const s of svgs) assert.ok(s.includes('width="24"') && s.includes('height="24"'), s);
});

test('404 page is a curl -i response with ways back', () => {
  const html = read('404.html');
  assert.equal(html.match(/<h1[\s>]/g)?.length, 1);
  assert.ok(html.includes('curl -i'));
  assert.match(html, /HTTP\/2 404 Not Found/);
  for (const href of ['/posts/', '/tags/', '/']) assert.ok(html.includes(`href="${href}"`), href);
  assert.equal(html.match(/class="btn-primary/g)?.length, 1);
  assert.ok(!read('sitemap-0.xml').includes('404'));
});

// The server's CSP has img-src 'self', and the site makes no third-party requests.
test('images are served from the site itself', () => {
  for (const f of files('.html')) {
    for (const [, src] of read(f).matchAll(/<img[^>]*\ssrc="([^"]+)"/g)) {
      assert.ok(!/^(https?:)?\/\//.test(src), `${f}: external image ${src}`);
    }
  }
});
