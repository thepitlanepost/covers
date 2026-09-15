import { html } from "satori-html";
import { TITLE_CHAR_BUDGET } from "./config.mjs";

// Hard truncation at a word boundary. Satori has no native line-clamp/ellipsis —
// confirmed by testing, not assumed — so this has to happen before rendering.
export function truncateTitle(title, maxChars = TITLE_CHAR_BUDGET) {
  if (!title) return "";
  if (title.length <= maxChars) return title;
  const cut = title.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
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
export function coverCombo({ w, h, num, title, label, accent, imageDataUri }) {
  const s = w / 1200;
  const trimmed = truncateTitle(title);
  const numBlock = num
    ? `<div style="font-family:Aileron;font-weight:800;font-size:${(imageDataUri ? 66 : 84) * s}px;color:${accent};line-height:1;display:flex;flex-shrink:0;">${num}</div>`
    : "";

  if (imageDataUri) {
    const markup = `
      <div style="width:${w}px;height:${h}px;display:flex;flex-direction:column;justify-content:space-between;position:relative;border:${6 * s}px solid #fff;box-sizing:border-box;overflow:hidden;color:#fff;">
        <img src="${imageDataUri}" style="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;" />
        <div style="position:relative;display:flex;align-items:center;gap:${8 * s}px;padding:${28 * s}px ${28 * s}px 0;">
          <div style="width:${14 * s}px;height:${14 * s}px;background:${accent};display:flex;"></div>
          <div style="font-family:Aileron;font-weight:800;font-size:${15 * s}px;text-transform:uppercase;letter-spacing:2px;background:rgba(0,0,0,0.55);padding:${4 * s}px ${8 * s}px;display:flex;">${label}</div>
        </div>
        <div style="position:relative;display:flex;align-items:flex-end;justify-content:space-between;gap:${16 * s}px;background:rgba(0,0,0,0.7);padding:${26 * s}px ${28 * s}px;">
          <div style="font-family:Aileron;font-weight:800;font-size:${42 * s}px;line-height:1.1;display:flex;max-width:78%;">${trimmed}</div>
          ${numBlock}
        </div>
      </div>
    `;
    return html(markup);
  }

  const markup = `
    <div style="width:${w}px;height:${h}px;display:flex;flex-direction:column;justify-content:space-between;background:#000;border:${6 * s}px solid #fff;box-sizing:border-box;padding:${30 * s}px;color:#fff;">
      <div style="display:flex;align-items:center;gap:${8 * s}px;">
        <div style="width:${14 * s}px;height:${14 * s}px;background:${accent};display:flex;"></div>
        <div style="font-family:Aileron;font-weight:800;font-size:${15 * s}px;text-transform:uppercase;letter-spacing:2px;opacity:0.6;display:flex;">${label}</div>
      </div>
      <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:${16 * s}px;">
        <div style="font-family:Aileron;font-weight:800;font-size:${48 * s}px;line-height:1.1;display:flex;max-width:78%;">${trimmed}</div>
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
export function coverNumberOnly({ w, h, num, accent, imageDataUri }) {
  const s = w / 1200;
  if (imageDataUri) {
    const markup = `
      <div style="width:${w}px;height:${h}px;display:flex;position:relative;border:${6 * s}px solid #fff;box-sizing:border-box;overflow:hidden;">
        <img src="${imageDataUri}" style="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;" />
        <div style="position:absolute;bottom:${20 * s}px;left:${20 * s}px;display:flex;align-items:center;gap:${10 * s}px;background:rgba(0,0,0,0.6);padding:${8 * s}px ${14 * s}px;">
          <div style="width:${12 * s}px;height:${12 * s}px;background:${accent};display:flex;"></div>
          <div style="font-family:Aileron;font-weight:800;font-size:${24 * s}px;color:#fff;display:flex;">${num}</div>
        </div>
      </div>
    `;
    return html(markup);
  }
  const markup = `
    <div style="width:${w}px;height:${h}px;display:flex;flex-direction:column;justify-content:space-between;background:#000;border:${6 * s}px solid #fff;box-sizing:border-box;padding:${28 * s}px;">
      <div style="width:${20 * s}px;height:${20 * s}px;background:${accent};display:flex;"></div>
      <div style="display:flex;align-items:flex-end;justify-content:space-between;">
        <div style="font-family:Aileron;font-weight:800;font-size:${260 * s}px;color:#fff;line-height:0.85;display:flex;">${num}</div>
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
export function coverAccentBlock({ w, h, accent }) {
  const s = w / 1200;
  const markup = `
    <div style="width:${w}px;height:${h}px;display:flex;align-items:flex-end;justify-content:flex-start;background:${accent};border:${6 * s}px solid #fff;box-sizing:border-box;padding:${28 * s}px;">
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

export function socialDossier({ w, h, site, label, title, dek, accent }) {
  const s = w / 1200;
  const titleSize = titleFontSize(title) * s;
  const markup = `
    <div style="width:${w}px;height:${h}px;display:flex;flex-direction:column;background:#000;border:${6 * s}px solid #fff;color:#fff;box-sizing:border-box;">
      <div style="display:flex;padding:${40 * s}px ${52 * s}px 0;">
        <div style="font-family:Aileron;font-size:${20 * s}px;font-weight:800;letter-spacing:3px;opacity:0.6;">${site.toUpperCase()}</div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;padding:0 ${52 * s}px ${44 * s}px;">
        <div style="height:${5 * s}px;width:100%;background:${accent};margin-bottom:${22 * s}px;display:flex;"></div>
        ${label ? `<div style="font-family:Aileron;font-size:${18 * s}px;font-weight:800;text-transform:uppercase;letter-spacing:2px;opacity:0.65;margin-bottom:${12 * s}px;display:flex;">${label}</div>` : ""}
        <div style="font-family:Aileron;font-size:${titleSize}px;font-weight:800;line-height:1.1;display:flex;margin-bottom:${14 * s}px;">${title}</div>
        ${dek ? `<div style="font-family:'Mozilla Text';font-size:${18 * s}px;font-weight:400;line-height:1.4;opacity:0.75;display:flex;max-width:92%;">${dek}</div>` : ""}
      </div>
    </div>
  `;
  return html(markup);
}
