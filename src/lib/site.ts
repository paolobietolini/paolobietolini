import { getEntry, type CollectionEntry } from 'astro:content';

export type Site = CollectionEntry<'config'>['data'];

export async function getSite(): Promise<Site> {
  const entry = await getEntry('config', 'site');
  if (!entry) throw new Error('config.yaml: missing top-level `site:` entry');
  return entry.data;
}