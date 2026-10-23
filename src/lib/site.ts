import { getEntry } from 'astro:content';

export type Site = {
  name: string;
  tagline: string;
  description: string;
  intro: string;
  nav: { label: string; href: string; accent?: boolean }[];
  socials: { label: string; href: string }[];
};

export async function getSite(): Promise<Site> {
  const entry = await getEntry('config', 'site');
  if (!entry) throw new Error('config.yaml: missing top-level `site:` entry');
  return entry.data;
}
