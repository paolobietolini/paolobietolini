// Pure post helpers: no astro:* imports, so `node --test` can load this file directly.

export type PostLike = {
  id: string;
  body?: string;
  data: {
    title: string;
    date: Date;
    updated?: Date;
    lang: 'en' | 'it';
    description: string;
    draft: boolean;
    tags?: string[];
    featured?: boolean;
  };
};

// Front-matter dates parse as UTC midnight; formatting in local time can show the previous day.
export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Post dates are days, not instants: a timestamp would render in UTC as a different day.
export function isPlainDay(d: Date): boolean {
  return d.getTime() % 86_400_000 === 0;
}

export function readingTime(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export function published<T extends PostLike>(posts: T[]): T[] {
  return posts
    .filter((p) => !p.data.draft)
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime() || a.id.localeCompare(b.id));
}

export function latest<T>(posts: T[], n = 5): T[] {
  return posts.slice(0, n);
}

export function metaLine(p: PostLike): string {
  return `${formatDate(p.data.date)} · ${p.data.lang.toUpperCase()} · ${readingTime(p.body ?? '')} min`;
}

// Stable URL segment for a tag: "Consent Mode" and "consent mode" share /tags/consent-mode/.
export function tagSlug(tag: string): string {
  return tag
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export type TagGroup<T> = { tag: string; slug: string; posts: T[] };

export function postsByTag<T extends PostLike>(posts: T[]): Map<string, TagGroup<T>> {
  const map = new Map<string, TagGroup<T>>();
  for (const p of posts) {
    for (const tag of p.data.tags ?? []) {
      const slug = tagSlug(tag);
      const group = map.get(slug) ?? { tag, slug, posts: [] };
      if (!group.posts.includes(p)) group.posts.push(p);
      map.set(slug, group);
    }
  }
  return map;
}

export function sortedTags<T>(map: Map<string, TagGroup<T>>): { tag: string; slug: string; count: number }[] {
  return [...map.values()]
    .map(({ tag, slug, posts }) => ({ tag, slug, count: posts.length }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

// `posts` is newest first (the output of `published`); neighbours are in the post's language only.
export function adjacentInLang<T extends PostLike>(posts: T[], post: T): { newer?: T; older?: T } {
  const same = posts.filter((p) => p.data.lang === post.data.lang);
  const i = same.indexOf(post);
  return { newer: i > 0 ? same[i - 1] : undefined, older: i >= 0 ? same[i + 1] : undefined };
}

export function featured<T extends PostLike>(posts: T[], n = 4): T[] {
  return posts.filter((p) => p.data.featured === true).slice(0, n);
}

export type Heading = { depth: number; slug: string; text: string };
export type TocItem = Heading & { level: number };

// Some posts start at ###, so nesting is relative to the shallowest heading kept.
export function tocItems(headings: Heading[]): TocItem[] {
  const kept = headings.filter((h) => h.depth >= 2 && h.depth <= 4);
  if (kept.length < 2) return [];
  const min = Math.min(...kept.map((h) => h.depth));
  return kept.map((h) => ({ ...h, level: h.depth - min }));
}
