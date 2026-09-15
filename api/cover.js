import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { fonts } from "../lib/fonts.mjs";
import { coverCombo, coverNumberOnly, coverAccentBlock, socialDossier } from "../lib/templates.mjs";
import { SIZES, DEFAULT_ACCENT, SITE_NAME, WEBP_QUALITY } from "../lib/config.mjs";

export const config = { runtime: "nodejs" };

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const IMAGE_FETCH_TIMEOUT_MS = 5000;

// Never let a bad/slow/dead linked-image URL take the whole cover down —
// fall back to the no-photo variant of whichever style was requested. This
// was a known, explicitly-flagged gap before it got fixed here.
async function fetchImageAsDataUri(url) {
  if (!url) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "image/jpeg";
    return `data:${contentType};base64,${buf.toString("base64")}`;
  } catch (err) {
    console.warn(`cover: image fetch failed for ${url}, falling back to no-photo variant —`, err.message);
    return null;
  }
}

function buildLabel(series, part) {
  if (part && series) return `Part ${String(part).padStart(2, "0")} — ${series}`;
  if (series) return series;
  return "";
}

export default async function handler(req, res) {
  try {
    const q = req.query;

    const size = q.size === "social" ? "social" : "cover";
    const { width, height } = SIZES[size];

    const style = ["combo", "number-only", "accent-block"].includes(q.style) ? q.style : "combo";
    const accent = HEX_RE.test(q.accent || "") ? q.accent : DEFAULT_ACCENT;
    const title = q.title || "Untitled";
    const part = q.part ? Number(q.part) : null;
    const num = part ? String(part).padStart(2, "0") : null;
    const label = buildLabel(q.series, part);

    const imageDataUri = await fetchImageAsDataUri(q.image);

    let tree;
    if (size === "social") {
      tree = socialDossier({ w: width, h: height, site: SITE_NAME, label, title, dek: q.dek || "", accent });
    } else if (style === "accent-block") {
      tree = coverAccentBlock({ w: width, h: height, accent });
    } else if (style === "number-only" && num) {
      // number-only without a number doesn't mean anything — fall back to combo
      tree = coverNumberOnly({ w: width, h: height, num, accent, imageDataUri });
    } else {
      tree = coverCombo({ w: width, h: height, num, title, label, accent, imageDataUri });
    }

    const svg = await satori(tree, { width, height, fonts });
    const png = new Resvg(svg).render().asPng();
    const webp = await sharp(png).webp({ quality: WEBP_QUALITY }).toBuffer();

    // Output is fully determined by the query params, so this is safe to
    // cache hard at the edge — same URL will always render the same image.
    res.setHeader("Content-Type", "image/webp");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.status(200).send(webp);
  } catch (err) {
    console.error("cover generation failed:", err);
    res.status(500).send("cover generation failed");
  }
}
