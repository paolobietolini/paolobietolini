// schema.org JSON-LD builders. Pure: no astro:* imports, so `node --test` can load this file directly.
import { formatDate, type PostLike } from './post-utils.ts';

type SiteLike = { name: string; description: string; socials: { href: string }[] };

const personId = (origin: string) => `${origin}/#person`;
const websiteId = (origin: string) => `${origin}/#website`;

function person(site: SiteLike, origin: string) {
  return {
    '@type': 'Person',
    '@id': personId(origin),
    name: site.name,
    url: `${origin}/`,
    description: site.description,
    sameAs: site.socials.map((s) => s.href).filter((h) => h.startsWith('http')),
  };
}

export function homeJsonLd(site: SiteLike, origin: string) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': websiteId(origin),
        url: `${origin}/`,
        name: site.name,
        description: site.description,
        inLanguage: ['en', 'it'],
        publisher: { '@id': personId(origin) },
      },
      person(site, origin),
    ],
  };
}

// Google wants full ISO 8601 datetimes with a timezone. Post dates are plain days parsed as
// UTC midnight, so that is the instant we publish.
export function isoDateTime(d: Date): string {
  return d.toISOString().replace('.000Z', 'Z');
}

// `modified` (an ISO datetime) is dropped unless its day falls after the publish day:
// an earlier or same-day edit is not an update.
export function postJsonLd(
  post: PostLike,
  opts: { site: SiteLike; origin: string; url: string; image: string; modified?: string },
) {
  const modified = opts.modified && opts.modified.slice(0, 10) > formatDate(post.data.date) ? opts.modified : undefined;
  const author = person(opts.site, opts.origin);
  return {
    '@context': 'https://schema.org',
    '@type': ['BlogPosting', 'TechArticle'],
    '@id': `${opts.url}#article`,
    headline: post.data.title,
    description: post.data.description,
    url: opts.url,
    mainEntityOfPage: opts.url,
    datePublished: isoDateTime(post.data.date),
    ...(modified && { dateModified: modified }),
    inLanguage: post.data.lang,
    image: opts.image,
    author: { '@type': author['@type'], '@id': author['@id'], name: author.name, url: author.url },
    publisher: { '@id': author['@id'] },
    isPartOf: { '@id': websiteId(opts.origin) },
  };
}

// JSON inside <script> must not be able to close the tag.
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
