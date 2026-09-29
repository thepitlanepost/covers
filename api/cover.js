import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { fonts } from "../lib/fonts.mjs";
import { coverCombo, coverNumberOnly, coverAccentBlock, socialDossier, socialPhotoForward } from "../lib/templates.mjs";
import { SIZES, DEFAULT_ACCENT, SITE_NAME, WEBP_QUALITY } from "../lib/config.mjs";

// Node.js is already the default runtime for a plain /api/*.js function with
// no framework — sharp needs that (it's a native module, won't run on Edge).
// No explicit runtime config needed to get it.

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const IMAGE_FETCH_TIMEOUT_MS = 5000;

// Never let a bad/slow/dead linked-image URL take the whole cover down —
// fall back to the no-photo variant of whichever style was requested. This
// was a known, explicitly-flagged gap before it got fixed here.
async function fetchImageAsDataUri(url, { width, height }) {
  if (!url) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ThePitlanePostCoverBot/1.0; +https://www.thepitlanepost.ca)",
        "Accept": "image/*",
      },
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`status ${res.status}`);
    // Deliberately lenient on content-type: plenty of hosts (S3, some CDNs)
    // serve real images as application/octet-stream. Only reject types that
    // are clearly not images (HTML from hotlink protection, JSON errors);
    // anything ambiguous goes to sharp, which throws on non-images anyway.
    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    if (/^(text\/|application\/(json|xml))/.test(contentType)) {
      throw new Error(`not an image (content-type: ${contentType}) — likely hotlink protection returning an HTML page instead`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    // Satori only decodes PNG/JPEG (not WebP/AVIF), so everything goes through
    // sharp. Crucially it is also RESIZED to the canvas and encoded as JPEG:
    // the old code re-encoded the full-resolution original as a lossless PNG,
    // which for a real photo is several MB of base64 and made rendering hang.
    // .rotate() applies EXIF orientation; .flatten() removes alpha (JPEG has none).
    const jpg = await sharp(buf)
      .rotate()
      .resize({ width, height, fit: "cover", position: "attention" })
      .flatten({ background: "#000" })
      .jpeg({ quality: 82, mozjpeg: false })
      .toBuffer();
    return `data:image/jpeg;base64,${jpg.toString("base64")}`;
  } catch (err) {
    console.warn(`cover: image fetch/transcode failed for ${url}, falling back to no-photo variant —`, err.message);
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
    const socialStyle = q.socialStyle === "photo-forward" ? "photo-forward" : "dossier";
    const mode = q.mode === "light" ? "light" : "dark"; // cover only — see note below
    const accent = HEX_RE.test(q.accent || "") ? q.accent : DEFAULT_ACCENT;
    const title = q.title || "Untitled";
    const part = q.part ? Number(q.part) : null;
    const num = part ? String(part).padStart(2, "0") : null;
    const label = buildLabel(q.series, part);

    const imageDataUri = await fetchImageAsDataUri(q.image, { width, height });

    let tree;
    if (size === "social") {
      // Social/OG images are fetched once by a link-unfurl crawler with no
      // browser and no theme state — there's no "current mode" to match, so
      // `mode` is deliberately ignored here and social always renders dark.
      if (socialStyle === "photo-forward" && imageDataUri) {
        // Doesn't mean anything without a photo — dossier is the sane fallback
        tree = socialPhotoForward({ w: width, h: height, site: SITE_NAME, title, accent, imageDataUri });
      } else {
        tree = socialDossier({ w: width, h: height, site: SITE_NAME, label, title, dek: q.dek || "", accent, imageDataUri });
      }
    } else if (style === "accent-block") {
      tree = coverAccentBlock({ w: width, h: height, accent, mode });
    } else if (style === "number-only" && num) {
      // number-only without a number doesn't mean anything — fall back to combo
      tree = coverNumberOnly({ w: width, h: height, num, accent, imageDataUri, mode });
    } else {
      tree = coverCombo({ w: width, h: height, num, title, label, accent, imageDataUri, mode });
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
