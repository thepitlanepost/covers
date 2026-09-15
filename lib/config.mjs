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
export const TITLE_CHAR_BUDGET = 70;

export const WEBP_QUALITY = 90;
