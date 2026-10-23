import { getCollection, type CollectionEntry } from 'astro:content';
import { published } from './post-utils';

export async function getPosts(): Promise<CollectionEntry<'posts'>[]> {
  return published(await getCollection('posts'));
}
