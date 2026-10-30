// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://paolobietolini.com',  
  integrations: [sitemap()],
  // The server's CSP (script-src 'self') blocks inline scripts: always ship bundled
  // scripts as files in /_astro/, however small.
  vite: { build: { assetsInlineLimit: 0 } },
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
    },
  },
});