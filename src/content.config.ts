import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { isPlainDay } from './lib/post-utils';

const link = z.object({ label: z.string(), href: z.string() }).strict();

const config = defineCollection({
  loader: file('config.yaml'),
  schema: z
    .object({
      name: z.string(),
      tagline: z.string(),
      description: z.string(),
      intro: z.string(),
      nav: z.array(link.extend({ accent: z.boolean().optional() }).strict()),
      socials: z.array(link),
      facts: z.array(z.object({ label: z.string(), value: z.string() }).strict()),
      about: z.string(),
      skills: z.array(z.object({ label: z.string(), items: z.array(z.string()) }).strict()),
      contact: z
        .object({ pitch: z.string(), note: z.string().optional(), label: z.string(), href: z.string() })
        .strict(),
    })
    .strict(),
});

const posts = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date().refine(isPlainDay, 'date must be a plain day (YYYY-MM-DD), without a time'),
    lang: z.enum(['en', 'it']),
    // Optional: overrides the last-modified day taken from git.
    updated: z.coerce.date().refine(isPlainDay, 'updated must be a plain day (YYYY-MM-DD), without a time').optional(),
    description: z.string(),
    draft: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
  }),
});

export const collections = { config, posts };
