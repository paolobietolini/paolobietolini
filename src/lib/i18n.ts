// UI strings on post pages follow the post's language.
export const labels = {
  en: { contents: 'Contents', previous: 'Previous post', next: 'Next post', tags: 'Tags' },
  it: { contents: 'Indice', previous: 'Articolo precedente', next: 'Articolo successivo', tags: 'Tag' },
} as const;

export type Lang = keyof typeof labels;
