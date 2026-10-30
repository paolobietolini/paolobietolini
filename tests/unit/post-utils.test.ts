import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDate, isPlainDay, readingTime, published, latest, metaLine,
  tagSlug, postsByTag, sortedTags, adjacentInLang, featured, tocItems,
  type PostLike,
} from '../../src/lib/post-utils.ts';

test('isPlainDay accepts a bare date and rejects one with a time', () => {
  assert.equal(isPlainDay(new Date('2026-08-03')), true);
  assert.equal(isPlainDay(new Date('2026-08-03T01:00:00+02:00')), false);
});

const post = (id: string, date: string, extra: Partial<PostLike['data']> = {}, body = 'word'): PostLike => ({
  id,
  body,
  data: { title: id, date: new Date(date), lang: 'en', description: '', draft: false, ...extra },
});

test('formatDate prints the front-matter date regardless of local time zone', () => {
  // `npm test` runs with TZ=America/Los_Angeles, where local time is 2026-08-02.
  assert.equal(formatDate(new Date('2026-08-03')), '2026-08-03');
});

test('readingTime is 200 wpm, rounded up, minimum 1', () => {
  assert.equal(readingTime(''), 1);
  assert.equal(readingTime(Array(200).fill('w').join(' ')), 1);
  assert.equal(readingTime(Array(201).fill('w').join(' ')), 2);
  assert.equal(readingTime('perché è così'), 1);
});

test('published drops drafts and sorts newest first, ties by id', () => {
  const out = published([
    post('old', '2026-07-01'),
    post('draft', '2026-09-01', { draft: true }),
    post('b', '2026-08-03'),
    post('a', '2026-08-03'),
  ]);
  assert.deepEqual(out.map((p) => p.id), ['a', 'b', 'old']);
});

test('latest returns at most n posts, default 5', () => {
  const many = Array.from({ length: 7 }, (_, i) => i);
  assert.deepEqual(latest(many.slice(0, 3)), [0, 1, 2]);
  assert.deepEqual(latest(many), [0, 1, 2, 3, 4]);
  assert.deepEqual(latest([]), []);
});

test('metaLine shows date, language and reading time', () => {
  const p = post('x', '2026-08-03', { lang: 'it' }, Array(1600).fill('parola').join(' '));
  assert.equal(metaLine(p), '2026-08-03 · IT · 8 min');
});

test('tagSlug lowercases, strips accents and hyphenates', () => {
  assert.equal(tagSlug('GA4'), 'ga4');
  assert.equal(tagSlug('consent mode'), 'consent-mode');
  assert.equal(tagSlug('Attribuzione è'), 'attribuzione-e');
  assert.equal(tagSlug(' server-side GTM '), 'server-side-gtm');
});

test('postsByTag groups by slug, keeps input order and first spelling', () => {
  const a = post('a', '2026-08-03', { tags: ['x', 'y'] });
  const b = post('b', '2026-08-02', { tags: ['y'] });
  const map = postsByTag([a, b]);
  assert.deepEqual([...map.keys()], ['x', 'y']);
  assert.deepEqual(map.get('y')!.posts.map((p) => p.id), ['a', 'b']);
  const merged = postsByTag([post('c', '2026-08-03', { tags: ['GA4'] }), post('d', '2026-08-02', { tags: ['ga4'] })]);
  assert.equal(merged.size, 1);
  assert.equal(merged.get('ga4')!.tag, 'GA4');
  assert.equal(postsByTag([post('e', '2026-08-03')]).size, 0);
});

test('sortedTags orders by count, then name', () => {
  const map = postsByTag([
    post('a', '2026-08-03', { tags: ['z', 'y'] }),
    post('b', '2026-08-02', { tags: ['y', 'x'] }),
  ]);
  assert.deepEqual(sortedTags(map).map((t) => [t.tag, t.count]), [['y', 2], ['x', 1], ['z', 1]]);
});

test('adjacentInLang finds neighbours in the same language only', () => {
  const list = [
    post('en1', '2026-08-04'),
    post('it1', '2026-08-03', { lang: 'it' }),
    post('en2', '2026-08-02'),
    post('en3', '2026-08-01'),
  ];
  const mid = adjacentInLang(list, list[2]);
  assert.equal(mid.newer?.id, 'en1');
  assert.equal(mid.older?.id, 'en3');
  assert.deepEqual(adjacentInLang(list, list[1]), { newer: undefined, older: undefined });
  assert.equal(adjacentInLang(list, list[0]).newer, undefined);
});

test('featured returns flagged posts in order, at most n', () => {
  const list = Array.from({ length: 7 }, (_, i) => post(`p${i}`, '2026-08-03', { featured: i !== 3 }));
  assert.deepEqual(featured(list).map((p) => p.id), ['p0', 'p1', 'p2', 'p4']);
  assert.deepEqual(featured([post('a', '2026-08-03')]), []);
});

test('tocItems keeps depth 2-4, levels relative to the shallowest, needs 2+', () => {
  const h = (depth: number) => ({ depth, slug: `h${depth}`, text: `H${depth}` });
  assert.deepEqual(tocItems([h(3), h(4), h(3)]).map((i) => i.level), [0, 1, 0]);
  assert.deepEqual(tocItems([h(2)]), []);
  assert.deepEqual(tocItems([h(1), h(2), h(5), h(3)]).map((i) => i.depth), [2, 3]);
  assert.deepEqual(tocItems([h(1), h(5)]), []);
});
