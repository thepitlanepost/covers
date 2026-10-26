// Central place for every URL and tunable this tool touches.
// Change a subdomain here once instead of hunting through every file.

export const SITE_NAME = "The Pitlane Post";
export const SITE_URL = "https://www.thepitlanepost.ca";
export const CDN_URL = "https://cdn.thepitlanepost.ca";
export const COVERS_URL = "https://covers.thepitlanepost.ca";

// "cover" matches the main site's .box aspect ratio (16:9) used for on-site
// article/blog thumbnails. "social" is the 1.91:1 ratio Open Graph / Twitter
// cards expect. Same width on both so one template layout covers both.
export const SIZES = {
  cover: { width: 1200, height: 675 },
  social: { width: 1200, height: 630 },
};

export const DEFAULT_ACCENT = "#ffffff"; // used if no seriesColor/categoryColor resolves

// Satori has no working CSS line-clamp/ellipsis (tested directly — it just
// overflows past the box). Titles get hard-truncated to this many characters,
// at a word boundary, before they're ever handed to the renderer. This is a
// starting guess, not a measured value — tune once real title lengths are in.
export const TITLE_CHAR_BUDGET = 90;

export const WEBP_QUALITY = 90;

// Auto-fit for the on-site cover title (used by fitTitleSize in
// lib/templates.mjs). Covers are shown at ~286px wide on the site, a ~4.2x
// downscale from the 1200px canvas, so titles need to be big. The title's
// font-size is the largest value from maxSize down to minSize (in 4px steps)
// whose estimated wrapped height fits `maxHeight`. `padding` and `widthShare`
// describe the space the title gets (canvas width minus padding both sides,
// times the share of it the title may use) — keep them in step with .combo in
// templates/covers.css if you change the layout there.
export const COVER_TITLE_FIT = {
  plain: { maxSize: 124, minSize: 64, maxHeight: 430, padding: 30, widthShare: 0.78 },
  photo: { maxSize: 124, minSize: 64, maxHeight: 250, padding: 30, widthShare: 0.78 },
  // Cover with a circuit outline: the title gets the left half, the outline
  // sits on the right (see .combo.circuit in templates/covers.css).
  circuit: { maxSize: 112, minSize: 60, maxHeight: 430, padding: 30, widthShare: 0.52 },
};

// Track outline on the cover (?circuit=...). The outline and its caption (the
// track name) are centred together in the free space to the right of the title.
// That space is the .outline-wrap box in templates/covers.css; `region` is its
// size in px, so the code knows how big the outline can be. Keep the two in
// step: width = 1200 - 2*border(6) - left(634) - right(30); heights =
// 675 - 2*border - top(94) - bottom(30, or 196 when there's a part number).
export const OUTLINE = {
  strokeShare: 0.03, // stroke thickness, as a share of the outline's longest side
  region: { width: 524, heightPlain: 539, heightWithNum: 373 },
  captionSize: 36, // px on the 1200px canvas (~8.6px on the site, so keep it chunky)
  captionGap: 22, // px between the outline and the track name
};

// Auto-fit for the label (top-left; the series/part text, or the race title).
// Same idea as COVER_TITLE_FIT but one line: the largest size that fits
// `availWidth` (canvas minus border/padding, minus the accent square), between
// minSize and the style's max.
export const LABEL_FIT = { maxSize: 44, photoMaxSize: 40, minSize: 28, availWidth: 1060 };
