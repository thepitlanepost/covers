# covers.thepitlanepost.ca

Dynamic cover + social-preview image generator for The Pitlane Post. Takes a
title and a bit of metadata, returns a WebP image. No Canva, no manual export.

## How it works

`satori` (HTML/CSS → SVG) → `resvg` (SVG → PNG) → `sharp` (PNG → WebP). Same
underlying engine as Vercel's own `@vercel/og`. One serverless function,
`api/cover.js`, does the whole thing per-request; Vercel caches the result at
the edge since the same query params always produce the same image.

What each image looks like is defined by plain HTML + CSS in `templates/` —
see [Customizing the look](#customizing-the-look).

## Local development

```
npm install
vercel dev
```

Then open `http://localhost:3000` for the preview form, or hit
`http://localhost:3000/api/cover?title=Test` directly.

For quick design iteration without the dev server, `npm run preview` renders a
set of sample covers and a contact sheet at the sizes they appear on the site
(see below).

## Customizing the look

Everything visual lives in `templates/`:

| File | What it is |
|---|---|
| `covers.css` | All styling for every style. Design tokens (colours, fonts, border width) are at the top. |
| `combo.html` | Default cover: label, title, optional part number |
| `number-only.html`, `accent-block.html` | Opt-in cover styles |
| `social-dossier.html`, `social-photo-forward.html` | Social / Open Graph images |

Edit the CSS, run `npm run preview`, and look at `preview/sheet.png` — it shows
each cover at 286px, 150px and 90px wide, which is roughly how they appear on
the site (`npm run preview -- --image <url>` adds photo samples). **Judge type
changes at those sizes, not at full size** — the 1200px canvas is shown at
~286px on the site, so anything that looks fine full-size can be unreadable
there.

Good to know:

- **It's normal CSS, with a few limits.** Satori can't read stylesheets, so
  `lib/render-template.mjs` inlines `covers.css` into each element at render
  time. Class / descendant / child / `:not()` selectors, `:root`, custom
  properties and `var()` all work. `@media`, `@font-face`, `@import`, nesting
  and `!important` don't (you get a clear error). Beyond that you're limited by
  what Satori supports (flexbox only, no grid, a subset of properties):
  <https://github.com/vercel/satori#css>.
- **Some values come from code, not CSS.** The accent colour (`--accent`), the
  auto-fitted title size (`--title-size`) and the canvas size are set per
  request. Auto-fit limits (max/min size, how much room the title gets) are in
  `COVER_TITLE_FIT` in `lib/config.mjs`; keep them in step with `.combo` in the
  CSS if you change that layout.
- **Placeholders and sections in the HTML.** `{{title}}` inserts a value;
  `{{#label}}...{{/label}}` keeps its contents only if `label` is non-empty;
  `{{^photo}}...{{/photo}}` keeps them only if it's empty. The values each
  template receives are set in `lib/templates.mjs`. Using a placeholder no
  value was passed for throws, so typos don't silently render blank.
- **Classes the code puts on the root element:** `.light` (light-mode cover),
  and exactly one of `.photo` / `.plain`. Style photo-vs-plain differences with
  e.g. `.combo.photo .title`.
- **Adding a template** = a new `.html` file, one line in `TEMPLATES` in
  `lib/render-template.mjs` (the path must stay a literal string, see the note
  on `fs.readFileSync` below), a function in `lib/templates.mjs`, and a branch
  in `api/cover.js`.

## API

`GET /api/cover`

| Param    | Required | Notes |
|----------|----------|-------|
| `title`  | yes      | Falls back to "Untitled" if missing. Truncated at `TITLE_CHAR_BUDGET` (config.mjs) on cover-size renders; shrinks font size instead on social. |
| `series` | no       | Series or category name. Combined with `part` to build the label ("Part 01 — X"), or shown alone if there's no part number. |
| `part`   | no       | Number. Only meaningful for numbered content (Explains parts). Omit for Weekend Verdict / blog. |
| `dek`    | no       | Social, `dossier` style only. Ignored on cover renders and on `photo-forward` — both deliberately. |
| `image`  | no       | Absolute URL to a photo to use as the background. Works on cover **and** social now. Fetched server-side; if it fails or times out, silently falls back to the no-photo variant rather than erroring. |
| `style`  | no       | Cover only. `combo` (default) / `number-only` / `accent-block`. `number-only` without a `part` falls back to `combo`. |
| `socialStyle` | no  | Social only. `dossier` (default — title, label, dek) or `photo-forward` (image-dominant, title only). `photo-forward` with no `image` falls back to `dossier`. |
| `size`   | no       | `cover` (1200×675, matches the site's `.box` ratio) or `social` (1200×630, standard OG ratio). Default `cover`. |
| `mode`   | no       | Cover only. `dark` (default) / `light`. Social renders ignore it and are always dark (a link-unfurl crawler has no theme). |
| `accent` | no       | Hex color, e.g. `%23c4302b` (URL-encode the `#`). Falls back to `DEFAULT_ACCENT` in config.mjs if missing or malformed. |

Example:
```
https://covers.thepitlanepost.ca/api/cover?title=The+HANS+device+and+the+Halo&series=Motorsport+Safety%2C+Then+vs.+Now&part=1&accent=%23c4302b&size=cover
```

## Design notes worth knowing before touching this

- **Cover and social are genuinely different jobs, not the same template at
  two sizes.** Cover images get shown small, next to real HTML text that
  already says the title — so cover styles lean on shape/color more than
  text. Social images get shown large in a link unfurl with nothing else
  around them, so the full title+dek treatment lives there.
- **Satori doesn't support `-webkit-line-clamp`** — tested directly, it just
  overflows the box. Title truncation on cover renders is a manual
  character-count cut at a word boundary (see `truncateTitle` in
  `lib/templates.mjs`), not a CSS property.
- **Text and the photo never go through the HTML parser.** Two separate
  reasons. (1) `satori-html` doesn't decode entities, so `&amp;` would render
  literally, and raw user text containing `<` breaks the markup. (2) Its
  parser is super-linear in attribute length: a ~390KB `src="data:..."` took
  ~33s to parse while Satori itself rendered in ~250ms. So templates carry
  `{{placeholders}}` and `lib/render-template.mjs` fills them into the *parsed*
  tree afterwards. Satori also has no CSS variables (`var()` throws), which is
  why that file resolves them itself.
- **Photos are resized and re-encoded before use.** Satori only decodes
  PNG/JPEG, so `api/cover.js` runs every `?image=` through sharp: EXIF-rotate,
  resize to the canvas, flatten alpha, JPEG. Keeping a lossless full-size PNG
  here is what used to make photo covers hang.
- **File paths in `lib/fonts.mjs` and `lib/render-template.mjs` are written out
  literally on purpose.** Vercel's function bundler traces static
  `fs.readFileSync` calls to decide what ships with the function;
  dynamically-built paths are unreliable for this. (Checked with `@vercel/nft`:
  it picks up every file in `templates/` this way.) `vercel.json`'s
  `includeFiles` is a second safety net for `node_modules`.
- **`sharp` will 500 in production even though the build succeeds, unless
  `vercel.json` force-includes all of `node_modules`.** `sharp@0.35.x` loads
  its native `libvips` library via `dlopen()` at runtime rather than a normal
  `require()`, so Vercel's file tracer frequently doesn't detect it needs
  bundling — you get `ERR_DLOPEN_FAILED: libvips-cpp.so... cannot open shared
  object file`, and it only shows up once deployed, never locally. This is a
  live, current problem with this sharp version specifically (not fixed by
  anything on our end) — `includeFiles: "node_modules/**"` is the reliable
  fix over trying to guess the exact `@img/sharp-*` sub-package names, which
  have changed between sharp versions before.
- **Fonts are real npm packages** (`@fontsource/aileron`, CC0;
  `@fontsource/mozilla-text`, SIL OFL) — same typefaces the main site uses,
  not substitutes. Aileron's fontsource mirror tops out at weight 800; the
  original release also has a 900/Black that isn't in this package.
