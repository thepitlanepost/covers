import { html } from "satori-html";
import { TITLE_CHAR_BUDGET } from "./config.mjs";

// satori-html's parser is super-linear in attribute length: a ~390KB data URI
// inside the markup string took ~33s to parse (Satori itself then rendered in
// ~250ms). So the markup only ever carries this short placeholder, and the
// real data URI is injected into the parsed tree afterwards.
const IMG_PLACEHOLDER = "__COVER_IMAGE__";

function injectImageSrc(node, src) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { node.forEach((n) => injectImageSrc(n, src)); return; }
  if (node.props?.src === IMG_PLACEHOLDER) node.props.src = src;
  if (node.props?.children) injectImageSrc(node.props.children, src);
}


// Pick the largest title size (px on the 1200-wide canvas) that fits `maxH`.
// Covers are shown at ~286px wide on the site (a ~4.2x downscale), so the old
// fixed 50-58px title came out at ~12-14px on screen. Size now scales with
// title length instead: short titles get huge, 70-char ones still fit.
// Width estimate is deliberately conservative (0.58em/char, 10% wrap slack).
function fitTitleSize(text, availW, maxH, max = 124, min = 64) {
  for (let size = max; size > min; size -= 4) {
    const perLine = Math.floor(availW / (0.58 * size)) * 0.9;
    const lines = Math.ceil(text.length / Math.max(perLine, 1));
    if (lines * 1.1 * size <= maxH) return size;
  }
  return min;
}

function htmlWithImage(markup, imageDataUri) {
  const tree = html(markup);
  injectImageSrc(tree, imageDataUri);
  return tree;
}

// Hard truncation at a word boundary. Satori has no native line-clamp/ellipsis —
// confirmed by testing, not assumed — so this has to happen before rendering.
export function truncateTitle(title, maxChars = TITLE_CHAR_BUDGET) {
  if (!title) return "";
  if (title.length <= maxChars) return title;
  const cut = title.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

// Cover-only. Values here are copied directly from the site's own
// html[data-color-mode="light"] block in style.css (--color-bg/--color-text/
// --color-border), not guessed — confirmed by reading it. Social never uses
// this: a link-unfurl crawler has no browser theme to match, so social stays
// fixed to the dark scheme regardless of what a viewer's site theme is.
function modeColors(mode) {
  return mode === "light"
    ? { bg: "#ffffff", text: "#000000", border: "#000000" }
    : { bg: "#000000", text: "#ffffff", border: "#ffffff" };
}

// ---------------------------------------------------------------------------
// Style: "combo" — DEFAULT. Title stays (trimmed/wrapped), part number and
// accent color if the content has them. `num` is optional throughout, which
// is what makes this the one style that has to work for every content type,
// series or not (Weekend Verdict / blog posts have no part number).
//
// NOTE on satori-html: the `html` import escapes anything interpolated into
// a TAGGED template (`` html`<div>${x}</div>` ``), including HTML fragments —
// so you cannot build a `<div>...</div>` string separately and splice it into
// a tagged template; it prints as literal escaped text instead of rendering.
// The fix used throughout this file: build the *entire* markup as one plain
// JS string first (conditionals included), then call `html(markup)` as a
// normal function on the finished string. Found this the hard way — verify
// visually if this pattern is ever changed.
// ---------------------------------------------------------------------------
export function coverCombo({ w, h, num, title, label, accent, imageDataUri, mode = "dark" }) {
  const s = w / 1200;
  const trimmed = truncateTitle(title);
  const availW = (w - 2 * 30 * s) * 0.78;
  const titlePx = fitTitleSize(trimmed, availW, (imageDataUri ? 250 : 430) * s) * s;
  const { bg, text, border } = modeColors(mode);
  const numBlock = num
    ? `<div style="font-family:Aileron;font-weight:700;font-size:${(imageDataUri ? 96 : 150) * s}px;color:${accent};line-height:1;display:flex;flex-shrink:0;">${num}</div>`
    : "";

  if (imageDataUri) {
    const markup = `
      <div style="width:${w}px;height:${h}px;display:flex;flex-direction:column;justify-content:space-between;position:relative;border:${6 * s}px solid ${border};box-sizing:border-box;overflow:hidden;color:#fff;">
        <img src="${IMG_PLACEHOLDER}" style="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;" />
        <div style="position:relative;display:flex;align-items:center;gap:${8 * s}px;padding:${28 * s}px ${28 * s}px 0;">
          <div style="width:${26 * s}px;height:${26 * s}px;background:${accent};display:flex;"></div>
          <div style="font-family:Aileron;font-weight:700;font-size:${40 * s}px;background:rgba(0,0,0,0.55);padding:${6 * s}px ${14 * s}px;display:flex;">${label}</div>
        </div>
        <div style="position:relative;display:flex;align-items:flex-end;justify-content:space-between;gap:${16 * s}px;background:rgba(0,0,0,0.7);padding:${26 * s}px ${28 * s}px;">
          <div style="font-family:Aileron;font-weight:700;font-size:${titlePx}px;line-height:1.1;display:flex;max-width:78%;">${trimmed}</div>
          ${numBlock}
        </div>
      </div>
    `;
    return htmlWithImage(markup, imageDataUri);
  }

  const markup = `
    <div style="width:${w}px;height:${h}px;display:flex;flex-direction:column;justify-content:space-between;background:${bg};border:${6 * s}px solid ${border};box-sizing:border-box;padding:${30 * s}px;color:${text};">
      <div style="display:flex;align-items:center;gap:${8 * s}px;">
        <div style="width:${26 * s}px;height:${26 * s}px;background:${accent};display:flex;"></div>
        <div style="font-family:Aileron;font-weight:700;font-size:${44 * s}px;opacity:0.7;display:flex;">${label}</div>
      </div>
      <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:${16 * s}px;">
        <div style="font-family:Aileron;font-weight:700;font-size:${titlePx}px;line-height:1.1;display:flex;max-width:78%;">${trimmed}</div>
        ${numBlock}
      </div>
    </div>
  `;
  return html(markup);
}

// ---------------------------------------------------------------------------
// Style: "number-only" — OPT-IN via frontmatter (coverStyle: number-only).
// Skips the title entirely. Only meaningful where `num` actually exists;
// api/cover.js falls back to "combo" if this is requested without a number.
// ---------------------------------------------------------------------------
export function coverNumberOnly({ w, h, num, accent, imageDataUri, mode = "dark" }) {
  const s = w / 1200;
  const { bg, text, border } = modeColors(mode);
  if (imageDataUri) {
    const markup = `
      <div style="width:${w}px;height:${h}px;display:flex;position:relative;border:${6 * s}px solid ${border};box-sizing:border-box;overflow:hidden;">
        <img src="${IMG_PLACEHOLDER}" style="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;" />
        <div style="position:absolute;bottom:${20 * s}px;left:${20 * s}px;display:flex;align-items:center;gap:${10 * s}px;background:rgba(0,0,0,0.6);padding:${8 * s}px ${14 * s}px;">
          <div style="width:${12 * s}px;height:${12 * s}px;background:${accent};display:flex;"></div>
          <div style="font-family:Aileron;font-weight:700;font-size:${24 * s}px;color:#fff;display:flex;">${num}</div>
        </div>
      </div>
    `;
    return htmlWithImage(markup, imageDataUri);
  }
  const markup = `
    <div style="width:${w}px;height:${h}px;display:flex;flex-direction:column;justify-content:space-between;background:${bg};border:${6 * s}px solid ${border};box-sizing:border-box;padding:${28 * s}px;">
      <div style="width:${20 * s}px;height:${20 * s}px;background:${accent};display:flex;"></div>
      <div style="display:flex;align-items:flex-end;justify-content:space-between;">
        <div style="font-family:Aileron;font-weight:700;font-size:${260 * s}px;color:${text};line-height:0.85;display:flex;">${num}</div>
        <div style="width:${100 * s}px;height:${8 * s}px;background:${accent};display:flex;margin-bottom:${20 * s}px;"></div>
      </div>
    </div>
  `;
  return html(markup);
}

// ---------------------------------------------------------------------------
// Style: "accent-block" — OPT-IN. Flat color field, no number, no title.
// Works for any content type since it never depends on a number existing.
// No photo variant — the whole point of this one is that it's just color.
// ---------------------------------------------------------------------------
export function coverAccentBlock({ w, h, accent, mode = "dark" }) {
  const s = w / 1200;
  const { border } = modeColors(mode);
  const markup = `
    <div style="width:${w}px;height:${h}px;display:flex;align-items:flex-end;justify-content:flex-start;background:${accent};border:${6 * s}px solid ${border};box-sizing:border-box;padding:${28 * s}px;">
      <div style="width:${64 * s}px;height:${10 * s}px;background:#000;display:flex;"></div>
    </div>
  `;
  return html(markup);
}

// ---------------------------------------------------------------------------
// Social — title + dek stays (this is the one viewed large in a link unfurl,
// with no adjacent HTML title to lean on). Carries accent color only, via the
// divider bar — no number/part mark, per instruction.
// ---------------------------------------------------------------------------
function titleFontSize(title) {
  const len = title.length;
  if (len <= 28) return 58;
  if (len <= 44) return 46;
  if (len <= 60) return 38;
  return 30;
}

export function socialDossier({ w, h, site, label, title, dek, accent, imageDataUri }) {
  const s = w / 1200;
  const titleSize = titleFontSize(title) * s;

  if (imageDataUri) {
    const markup = `
      <div style="width:${w}px;height:${h}px;display:flex;flex-direction:column;position:relative;border:${6 * s}px solid #fff;color:#fff;box-sizing:border-box;overflow:hidden;">
        <img src="${IMG_PLACEHOLDER}" style="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;" />
        <div style="position:relative;display:flex;padding:${40 * s}px ${52 * s}px 0;">
          <div style="font-family:Aileron;font-size:${20 * s}px;font-weight:700;background:rgba(0,0,0,0.55);padding:${4 * s}px ${8 * s}px;display:flex;">${site}</div>
        </div>
        <div style="position:relative;flex:1;display:flex;flex-direction:column;justify-content:flex-end;">
          <div style="display:flex;flex-direction:column;background:rgba(0,0,0,0.72);padding:${34 * s}px ${52 * s}px ${44 * s}px;">
            <div style="height:${5 * s}px;width:100%;background:${accent};margin-bottom:${22 * s}px;display:flex;"></div>
            ${label ? `<div style="font-family:Aileron;font-size:${18 * s}px;font-weight:700;opacity:0.75;margin-bottom:${12 * s}px;display:flex;">${label}</div>` : ""}
            <div style="font-family:Aileron;font-size:${titleSize}px;font-weight:700;line-height:1.1;display:flex;margin-bottom:${14 * s}px;">${title}</div>
            ${dek ? `<div style="font-family:'Mozilla Text';font-size:${18 * s}px;font-weight:400;line-height:1.4;opacity:0.8;display:flex;max-width:92%;">${dek}</div>` : ""}
          </div>
        </div>
      </div>
    `;
    return htmlWithImage(markup, imageDataUri);
  }

  const markup = `
    <div style="width:${w}px;height:${h}px;display:flex;flex-direction:column;background:#000;border:${6 * s}px solid #fff;color:#fff;box-sizing:border-box;">
      <div style="display:flex;padding:${40 * s}px ${52 * s}px 0;">
        <div style="font-family:Aileron;font-size:${20 * s}px;font-weight:700;opacity:0.6;">${site}</div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;padding:0 ${52 * s}px ${44 * s}px;">
        <div style="height:${5 * s}px;width:100%;background:${accent};margin-bottom:${22 * s}px;display:flex;"></div>
        ${label ? `<div style="font-family:Aileron;font-size:${18 * s}px;font-weight:700;opacity:0.65;margin-bottom:${12 * s}px;display:flex;">${label}</div>` : ""}
        <div style="font-family:Aileron;font-size:${titleSize}px;font-weight:700;line-height:1.1;display:flex;margin-bottom:${14 * s}px;">${title}</div>
        ${dek ? `<div style="font-family:'Mozilla Text';font-size:${18 * s}px;font-weight:400;line-height:1.4;opacity:0.75;display:flex;max-width:92%;">${dek}</div>` : ""}
      </div>
    </div>
  `;
  return html(markup);
}

// ---------------------------------------------------------------------------
// Style: "photo-forward" — OPT-IN social alternative (socialStyle=photo-forward).
// Image does the work; title only, no dek, no separate label row. Still no
// number/part mark on social — that rule doesn't change just because a photo
// is involved. Falls back to socialDossier in api/cover.js if no image is
// actually supplied, since this style has no reason to exist without one.
// ---------------------------------------------------------------------------
export function socialPhotoForward({ w, h, site, title, accent, imageDataUri }) {
  const s = w / 1200;
  const trimmed = truncateTitle(title, 90);
  const markup = `
    <div style="width:${w}px;height:${h}px;display:flex;position:relative;border:${6 * s}px solid #fff;box-sizing:border-box;overflow:hidden;color:#fff;">
      <img src="${IMG_PLACEHOLDER}" style="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;" />
      <div style="position:absolute;top:${28 * s}px;left:${28 * s}px;display:flex;align-items:center;gap:${8 * s}px;">
        <div style="width:${12 * s}px;height:${12 * s}px;background:${accent};display:flex;"></div>
        <div style="font-family:Aileron;font-size:${15 * s}px;font-weight:700;background:rgba(0,0,0,0.55);padding:${4 * s}px ${8 * s}px;display:flex;">${site}</div>
      </div>
      <div style="position:absolute;bottom:0;left:0;width:100%;background:rgba(0,0,0,0.68);padding:${28 * s}px ${32 * s}px;display:flex;">
        <div style="font-family:Aileron;font-weight:700;font-size:${44 * s}px;line-height:1.1;display:flex;">${trimmed}</div>
      </div>
    </div>
  `;
  return htmlWithImage(markup, imageDataUri);
}
