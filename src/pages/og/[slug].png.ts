// Per-post social preview, rendered at build time. Layout follows "Social preview" in brand/BRAND.md.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { APIRoute, GetStaticPaths } from 'astro';
import type { CollectionEntry } from 'astro:content';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { getPosts } from '../../lib/posts';
import { formatDate } from '../../lib/post-utils';

// Satori reads woff/ttf, not woff2, so the fonts come from @fontsource rather than public/fonts.
const require = createRequire(import.meta.url);
const font = (pkg: string, file: string) => readFileSync(require.resolve(`@fontsource/${pkg}/files/${file}`));
const fonts = [
  { name: 'Schibsted Grotesk', data: font('schibsted-grotesk', 'schibsted-grotesk-latin-700-normal.woff'), weight: 700 as const },
  { name: 'Geist Mono', data: font('geist-mono', 'geist-mono-latin-400-normal.woff'), weight: 400 as const },
  { name: 'Geist Mono', data: font('geist-mono', 'geist-mono-latin-500-normal.woff'), weight: 500 as const },
];

const INK = '#EEEDF4';
const MUTED = '#9C98B0';
const ACCENT = '#A493FF';

// The spec caps titles at 3 lines. 76px fits about 70 characters in 3 lines; step down for longer titles.
const titleSize = (title: string) => (title.length <= 70 ? 76 : title.length <= 100 ? 62 : 52);

const h = (type: string, style: Record<string, unknown>, children?: unknown) => ({ type, props: { style, children } });

export const getStaticPaths = (async () => {
  const posts = await getPosts();
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute<{ post: CollectionEntry<'posts'> }> = async ({ props }) => {
  const { title, date } = props.post.data;
  const size = titleSize(title);
  const svg = await satori(
    h(
      'div',
      // No padding on the root: satori adds it on top of height 100%, which pushes the bottom edge off the canvas.
      {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#14121F',
      },
      [
        h('div', { display: 'flex', alignItems: 'center', margin: '80px 80px 0' }, [
          // Optical gap of 0.28em between braces and initials, per the brand symbol.
          h('div', { display: 'flex', gap: 11, fontFamily: 'Geist Mono', fontWeight: 500, fontSize: 40, color: ACCENT, letterSpacing: '-0.02em' }, [
            h('span', {}, '{'),
            h('span', {}, 'PB'),
            h('span', {}, '}'),
          ]),
          h('div', { marginLeft: 24, fontFamily: 'Schibsted Grotesk', fontWeight: 700, fontSize: 30, color: INK, letterSpacing: '-0.02em' }, 'Paolo Bietolini'),
        ]),
        h(
          'div',
          {
            display: 'flex',
            margin: '100px 80px 0',
            maxWidth: 1040,
            fontFamily: 'Schibsted Grotesk',
            fontWeight: 700,
            fontSize: size,
            lineHeight: `${Math.round(size * 1.13)}px`,
            letterSpacing: '-0.03em',
            color: INK,
          },
          title,
        ),
        h('div', { display: 'flex', position: 'absolute', left: 80, bottom: 80, fontFamily: 'Geist Mono', fontWeight: 400, fontSize: 22, color: MUTED }, `${formatDate(date)} · paolobietolini.com`),
      ],
    ) as Parameters<typeof satori>[0],
    { width: 1200, height: 630, fonts },
  );
  const png = new Resvg(svg).render().asPng();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
