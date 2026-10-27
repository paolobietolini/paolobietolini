import { test } from 'node:test';
import assert from 'node:assert/strict';
import { postJsonLd, homeJsonLd, serializeJsonLd } from '../../src/lib/structured-data.ts';
import type { PostLike } from '../../src/lib/post-utils.ts';

const site = {
  name: 'Paolo Bietolini',
  description: 'desc',
  socials: [{ href: 'https://github.com/x' }, { href: 'mailto:a@b.c' }],
};
const origin = 'https://example.com';
const post: PostLike = {
  id: 'p',
  data: { title: 'T', date: new Date('2025-04-04'), lang: 'it', description: 'D', draft: false },
};
const ld = (modified?: string) =>
  postJsonLd(post, { site, origin, url: `${origin}/posts/p/`, image: `${origin}/og/p.png`, modified });

test('post JSON-LD carries the post fields', () => {
  const a = ld();
  assert.deepEqual(a['@type'], ['BlogPosting', 'TechArticle']);
  assert.equal(a.headline, 'T');
  assert.equal(a.datePublished, '2025-04-04T00:00:00Z');
  assert.equal(a.inLanguage, 'it');
  assert.equal(a.author['@id'], `${origin}/#person`);
  assert.equal('dateModified' in a, false);
});

test('dateModified only when after the publish day', () => {
  assert.equal(ld('2026-11-01T10:20:30+01:00').dateModified, '2026-11-01T10:20:30+01:00');
  assert.equal('dateModified' in ld('2025-04-04T18:00:00+02:00'), false);
  assert.equal('dateModified' in ld('2025-01-01T00:00:00Z'), false);
});

test('home Person sameAs keeps only web profiles', () => {
  const person = homeJsonLd(site, origin)['@graph'][1] as { sameAs: string[] };
  assert.deepEqual(person.sameAs, ['https://github.com/x']);
});

test('serializeJsonLd cannot close the script tag', () => {
  assert.ok(!serializeJsonLd({ x: '</script><b>' }).includes('</script>'));
});
