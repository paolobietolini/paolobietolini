import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

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

test('no client script on any page', () => {
  for (const f of files('.html')) assert.ok(!read(f).includes('<script'), f);
});

test('brand fonts are shipped', () => {
  assert.ok(existsSync(join(DIST, 'fonts/schibsted-grotesk-latin-700.woff2')));
});

test('no third-party font hosts', () => {
  for (const f of [...files('.html'), ...files('.css')]) {
    assert.ok(!/fonts\.(googleapis|gstatic)/.test(read(f)), f);
  }
});

const EN_TITLE = 'How a dataLayer push becomes a hit';
const IT_TITLE = 'Consenso e tag manager: cosa succede davvero';
const DRAFT_TITLE = 'Server-side tagging, without the magic';

test('post list shows published posts only', () => {
  const html = read('posts/index.html');
  assert.ok(html.includes(EN_TITLE));
  assert.ok(html.includes(IT_TITLE));
  assert.ok(!html.includes(DRAFT_TITLE));
});

test('draft has no page', () => {
  assert.ok(!existsSync(join(DIST, 'posts/draft-server-side-tagging')));
});

test('italian post sets lang', () => {
  assert.ok(read('posts/consenso-e-tag-manager/index.html').includes('<html lang="it"'));
});

test('post page shows meta line', () => {
  const html = read('posts/how-a-datalayer-push-becomes-a-hit/index.html');
  assert.ok(html.includes('· EN ·'));
  assert.ok(html.includes(' min'));
});

test('home lists latest posts', () => {
  const html = read('index.html');
  assert.ok(html.includes(EN_TITLE));
  assert.ok(html.includes(IT_TITLE));
  assert.ok(!html.includes(DRAFT_TITLE));
  assert.ok(html.includes('href="/posts/"'));
});

test('rss lists published posts', () => {
  const xml = read('rss.xml');
  assert.ok(xml.startsWith('<?xml'));
  assert.equal(xml.match(/<item>/g)?.length, 2);
  assert.ok(!xml.includes(DRAFT_TITLE));
});

test('sitemap excludes draft', () => {
  const xml = read('sitemap-0.xml');
  assert.ok(xml.includes('/posts/how-a-datalayer-push-becomes-a-hit/'));
  assert.ok(!xml.includes('draft-server-side-tagging'));
});

test('head meta', () => {
  const html = read('posts/how-a-datalayer-push-becomes-a-hit/index.html');
  for (const s of ['rel="canonical"', 'og:image', 'summary_large_image', 'application/rss+xml']) {
    assert.ok(html.includes(s), s);
  }
});

test('code is dual-theme', () => {
  assert.ok(read('posts/how-a-datalayer-push-becomes-a-hit/index.html').includes('--shiki-dark'));
});
