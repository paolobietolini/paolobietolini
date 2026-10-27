// Pure post helpers: no astro:* imports, so `node --test` can load this file directly.

export type PostLike = {
  id: string;
  body?: string;
  data: { title: string; date: Date; updated?: Date; lang: 'en' | 'it'; description: string; draft: boolean };
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
