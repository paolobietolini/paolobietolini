import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDate, isPlainDay, readingTime, published, latest, metaLine, type PostLike } from '../../src/lib/post-utils.ts';

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
