# covers.thepitlanepost.ca

Dynamic cover + social-preview image generator for The Pitlane Post. Takes a
title and a bit of metadata, returns a WebP image. No Canva, no manual export.

## How it works

`satori` (HTML/CSS → SVG) → `resvg` (SVG → PNG) → `sharp` (PNG → WebP). Same
underlying engine as Vercel's own `@vercel/og`. One serverless function,
`api/cover.js`, does the whole thing per-request; Vercel caches the result at
the edge since the same query params always produce the same image.

## Local development

```
npm install
vercel dev
```

Then open `http://localhost:3000` for the preview form, or hit
`http://localhost:3000/api/cover?title=Test` directly.

## API

`GET /api/cover`

| Param    | Required | Notes |
|----------|----------|-------|
| `title`  | yes      | Falls back to "Untitled" if missing. Truncated at `TITLE_CHAR_BUDGET` (config.mjs) on cover-size renders; shrinks font size instead on social. |
| `series` | no       | Series or category name. Combined with `part` to build the label ("Part 01 — X"), or shown alone if there's no part number. |
| `part`   | no       | Number. Only meaningful for numbered content (Explains parts). Omit for Weekend Verdict / blog. |
| `dek`    | no       | Social only. Ignored on cover-size renders — deliberately, see DESIGN.md notes below. |
| `image`  | no       | Absolute URL to a photo to use as the background. Fetched server-side; if it fails or times out, silently falls back to the no-photo variant rather than erroring. |
| `style`  | no       | `combo` (default) / `number-only` / `accent-block`. `number-only` without a `part` falls back to `combo`. |
| `size`   | no       | `cover` (1200×675, matches the site's `.box` ratio) or `social` (1200×630, standard OG ratio). Default `cover`. |
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
- **`satori-html`'s `html` tag escapes interpolated HTML fragments.** You
  cannot build a `<div>...</div>` string separately and splice it into a
  tagged `` html`...${fragment}` `` template — it prints as literal text.
  Build the complete markup as a plain string first, then call `html(markup)`
  as a function. Every template in `lib/templates.mjs` follows this pattern.
- **Font paths in `lib/fonts.mjs` are written out literally on purpose.**
  Vercel's function bundler traces static `fs.readFileSync` calls to decide
  what ships with the function; dynamically-built paths are unreliable for
  this. `vercel.json`'s `includeFiles` is a second safety net on top of that.
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

## Deploying

Push to `main`, connect the repo to a new Vercel project, point
`covers.thepitlanepost.ca` at it in DNS. No environment variables needed.
