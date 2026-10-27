import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

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

test('no client script on any page (JSON-LD data blocks only)', () => {
  for (const f of files('.html')) {
    const scripts = read(f).match(/<script[^>]*>/g) ?? [];
    for (const tag of scripts) assert.ok(tag.includes('type="application/ld+json"'), `${f}: ${tag}`);
  }
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
    return { file: f, title: String(fm.title), lang: fm.lang as string, draft: fm.draft === true };
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
