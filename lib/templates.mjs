// Data prep for the cover / social templates. What each image LOOKS like lives
// in templates/*.html (structure) and templates/covers.css (styling) — this
// file only decides the values that need code: truncating and fitting the
// title, building flags like "is there a photo", and passing per-request
// values (accent colour, title size) down to the CSS. The mechanics of turning
// HTML+CSS into something Satori can render are in lib/render-template.mjs.
//
// Exported function names/signatures are what api/cover.js calls; the
// `imageDataUri` params are the already-fetched, already-resized JPEG data URI
// (or null). It is only ever handed to the renderer as a {{image}} value, never
// spliced into markup — see the notes in render-template.mjs.

import { TITLE_CHAR_BUDGET, COVER_TITLE_FIT, OUTLINE, LABEL_FIT } from "./config.mjs";
import { renderTemplate } from "./render-template.mjs";

// Hard truncation at a word boundary. Satori has no native line-clamp/ellipsis —
// confirmed by testing, not assumed — so this has to happen before rendering.
export function truncateTitle(title, maxChars = TITLE_CHAR_BUDGET) {
  if (!title) return "";
  if (title.length <= maxChars) return title;
  const cut = title.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

// Pick the largest title size (px on the 1200-wide canvas) that fits `maxH`.
// Covers are shown at ~286px wide on the site (a ~4.2x downscale), so the old
// fixed 50-58px title came out at ~12-14px on screen. Size scales with title
// length instead: short titles get huge, 70-char ones still fit.
// Width estimate is deliberately conservative (0.58em/char, 10% wrap slack).
function fitTitleSize(text, availW, maxH, max, min) {
  for (let size = max; size > min; size -= 4) {
    const perLine = Math.floor(availW / (0.58 * size)) * 0.9;
    const lines = Math.ceil(text.length / Math.max(perLine, 1));
    if (lines * 1.1 * size <= maxH) return size;
  }
  return min;
}

// One-line fit for the label: the biggest size (up to `max`) whose estimated
// width fits LABEL_FIT.availWidth, never below LABEL_FIT.minSize. Past that it
// wraps rather than shrinking further. Same conservative 0.58em/char estimate.
function fitLabelSize(text, max) {
  const fit = Math.floor(LABEL_FIT.availWidth / (0.58 * Math.max(text.length, 1)));
  return Math.max(LABEL_FIT.minSize, Math.min(max, fit));
}

// Scale the circuit outline to the biggest size that fits in OUTLINE.region
// once the caption (track name) is under it, keeping its proportions. Returns
// px sizes for the CSS (--outline-w/-h etc. in covers.css). The caption's line
// count is an estimate; the 0.58em/char figure is deliberately on the wide
// side, so if anything the outline comes out slightly smaller than it could.
function fitOutline(outline, hasNum) {
  const { region, captionSize, captionGap } = OUTLINE;
  const lines = Math.ceil((outline.name.length * 0.58 * captionSize) / region.width);
  const captionH = lines * captionSize * 1.2 + captionGap;
  const boxW = region.width;
  const boxH = (hasNum ? region.heightWithNum : region.heightPlain) - captionH;
  const scale = Math.min(boxW / outline.width, boxH / outline.height);
  return { width: Math.round(outline.width * scale), height: Math.round(outline.height * scale) };
}

// Social titles: simple length steps (social is viewed large in a link unfurl,
// so it doesn't need the fit-to-frame treatment covers get).
function titleFontSize(title) {
  const len = title.length;
  if (len <= 28) return 58;
  if (len <= 44) return 46;
  if (len <= 60) return 38;
  return 30;
}

// ---------------------------------------------------------------------------
// Style: "combo" — DEFAULT. Title stays (trimmed/wrapped), part number and
// accent color if the content has them, and optionally a circuit outline. `num` is optional throughout, which
// is what makes this the one style that has to work for every content type,
// series or not (Weekend Verdict / blog posts have no part number).
// Markup: templates/combo.html
// ---------------------------------------------------------------------------
export function coverCombo({ w, h, num, title, label, accent, imageDataUri, outline: outlineInfo, mode = "dark" }) {
  const trimmed = truncateTitle(title);
  // A circuit outline only goes on the plain cover; a photo already fills the
  // frame, so with one the outline is ignored.
  const outline = imageDataUri ? null : outlineInfo || null;
  const fit = imageDataUri ? COVER_TITLE_FIT.photo : outline ? COVER_TITLE_FIT.circuit : COVER_TITLE_FIT.plain;
  const titleSize = fitTitleSize(trimmed, (w - 2 * fit.padding) * fit.widthShare, fit.maxHeight, fit.maxSize, fit.minSize);
  const vars = {
    accent,
    "title-size": `${titleSize}px`,
    "label-size": `${fitLabelSize(label || "", imageDataUri ? LABEL_FIT.photoMaxSize : LABEL_FIT.maxSize)}px`,
  };
  if (outline) {
    const box = fitOutline(outline, Boolean(num));
    vars["outline-w"] = `${box.width}px`;
    vars["outline-h"] = `${box.height}px`;
    vars["outline-gap"] = `${OUTLINE.captionGap}px`;
    vars["outline-name-size"] = `${OUTLINE.captionSize}px`;
  }
  return renderTemplate("combo", {
    width: w,
    height: h,
    vars,
    data: {
      title: trimmed,
      label,
      num,
      image: imageDataUri,
      outline: outline ? outline.dataUri : "",
      outlineName: outline ? outline.name : "",
      photo: Boolean(imageDataUri),
      light: mode === "light",
    },
  });
}

// ---------------------------------------------------------------------------
// Style: "number-only" — OPT-IN via frontmatter (coverStyle: number-only).
// Skips the title entirely. Only meaningful where `num` actually exists;
// api/cover.js falls back to "combo" if this is requested without a number.
// Markup: templates/number-only.html
// ---------------------------------------------------------------------------
export function coverNumberOnly({ w, h, num, accent, imageDataUri, mode = "dark" }) {
  return renderTemplate("number-only", {
    width: w,
    height: h,
    vars: { accent },
    data: { num, image: imageDataUri, photo: Boolean(imageDataUri), light: mode === "light" },
  });
}

// ---------------------------------------------------------------------------
// Style: "accent-block" — OPT-IN. Flat color field, no number, no title.
// Works for any content type since it never depends on a number existing.
// No photo variant — the whole point of this one is that it's just color.
// Markup: templates/accent-block.html
// ---------------------------------------------------------------------------
export function coverAccentBlock({ w, h, accent, mode = "dark" }) {
  return renderTemplate("accent-block", {
    width: w,
    height: h,
    vars: { accent },
    data: { light: mode === "light" },
  });
}

// ---------------------------------------------------------------------------
// Social — title + dek stays (this is the one viewed large in a link unfurl,
// with no adjacent HTML title to lean on). Carries accent color only, via the
// divider bar — no number/part mark, per instruction. Always dark: a
// link-unfurl crawler has no browser theme, so there is no `mode` here.
// Markup: templates/social-dossier.html
// ---------------------------------------------------------------------------
export function socialDossier({ w, h, site, label, title, dek, accent, imageDataUri }) {
  return renderTemplate("social-dossier", {
    width: w,
    height: h,
    vars: { accent, "title-size": `${titleFontSize(title)}px` },
    data: { site, label, title, dek, image: imageDataUri, photo: Boolean(imageDataUri) },
  });
}

// ---------------------------------------------------------------------------
// Style: "photo-forward" — OPT-IN social alternative (socialStyle=photo-forward).
// Image does the work; title only, no dek, no separate label row. Still no
// number/part mark on social — that rule doesn't change just because a photo
// is involved. Falls back to socialDossier in api/cover.js if no image is
// actually supplied, since this style has no reason to exist without one.
// Markup: templates/social-photo-forward.html
// ---------------------------------------------------------------------------
export function socialPhotoForward({ w, h, site, title, accent, imageDataUri }) {
  return renderTemplate("social-photo-forward", {
    width: w,
    height: h,
    vars: { accent },
    data: { site, title: truncateTitle(title, 90), image: imageDataUri },
  });
}
