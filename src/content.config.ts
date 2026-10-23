import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { z } from 'astro/zod';

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
    })
    .strict(),
});

export const collections = { config };
