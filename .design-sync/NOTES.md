# design-sync notes

- **Tokens-only DS.** No React components exist; `.design-sync/entry.js` is an empty module that gives the converter a package entry (`cfg.entry`). The converter logs `[ZERO_MATCH] ... treating as tokens-only DS` and `[DTS_REACT]`. Both are expected; ignore them.
- **Converter deps.** The repo has no React. Install `react@18.3.1 react-dom@18.3.1` (vendored into `_vendor/`) and `playwright` into `.ds-sync/` next to esbuild/ts-morph, then pass `--node-modules ./.ds-sync/node_modules`. The cached chromium here is build 1248, which matches `playwright@1.64.0`.
- **Fonts.** `brand/tokens.css` uses site-absolute `url("/fonts/...")`, which the converter can't resolve. `.design-sync/fonts.css` mirrors those `@font-face` rules with paths relative to the repo (`cfg.extraFonts`), so the woff2s get copied into `fonts/`. The bundle's `fonts/fonts.css` still carries the 6 dead `/fonts/` rules *before* the 6 good ones. The later rules win: verified in headless chromium with `/fonts/` returning 404, all faces loaded from the bundle. Harmless, but don't reorder them.
- **Not synced.** Logo SVGs (`brand/logo/`), the avatar and favicons. The upload format has no slot for raw assets. The design agent gets the text logo `.pb-mark` instead.
- Build: `node .ds-sync/resync.mjs --config .design-sync/config.json --node-modules ./.ds-sync/node_modules --out ./ds-bundle [--remote .design-sync/.cache/remote-sync.json]`

## Re-sync risks

- `.design-sync/fonts.css` duplicates the font list in `brand/tokens.css`. If a weight or file is added or renamed there, update this file too, or the bundle ships a fallback font.
- `.design-sync/conventions.md` lists token names by hand. Re-validate them against `ds-bundle/_ds_bundle.css` whenever `tokens.css` changes.
- If real components are added later (e.g. `src/components/*.tsx` in React), drop `entry` and point the config at the real build.
