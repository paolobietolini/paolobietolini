import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getSite } from '../lib/site';
import { getPosts } from '../lib/posts';

export async function GET(context: APIContext) {
  const site = await getSite();
  const posts = await getPosts();
  return rss({
    title: site.name,
    description: site.description,
    site: context.site!,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.description,
      link: `/posts/${post.id}/`,
    })),
  });
}
