// Renders the built /cv/ page to dist/cv.pdf with headless Chromium.
// Runs after `astro build`; layout comes from the print rules in src/styles/cv.css.
import { preview } from 'astro';
import { chromium } from 'playwright';

const server = await preview({ logLevel: 'error' });
const browser = await chromium.launch();

try {
  // Light scheme so the PDF never picks up the dark theme
  const page = await browser.newPage({ colorScheme: 'light' });
  await page.goto(`http://localhost:${server.port}/cv/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: `dist/PaoloBietolini_${new Date().getFullYear()}.pdf`, preferCSSPageSize: true, printBackground: true });
} finally {
  await browser.close();
  await server.stop();
}
