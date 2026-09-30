// Renders a fixed set of sample covers through the real handler and builds a
// contact sheet at the sizes they actually appear on the site (286 / 150 / 90px
// wide), so you can judge a CSS change by looking at it instead of guessing.
//
//   npm run preview
//   npm run preview -- --image https://example.com/photo.jpg   (adds photo samples)
//
// Output goes to ./preview (gitignored): sheet.png + one full-size file per sample.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import handler from "../api/cover.js";

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "preview");
fs.mkdirSync(outDir, { recursive: true });

const argIdx = process.argv.indexOf("--image");
const image = argIdx > -1 ? process.argv[argIdx + 1] : undefined;

const SHORT = "Where we've been";
const MEDIUM = "Why the halo took a decade to be accepted";
const LONG = "New homepage, AI protection, and more | Patch Notes: August 7";
const OVER = "Could Kimi Antonelli really be the next great F1 driver in the world? Plus a very long tail that gets cut";
const base = { series: "Explains: Safety", accent: "#e10600" };

const covers = [
  ["combo, short title", { ...base, title: SHORT, part: 1 }],
  ["combo, medium title", { ...base, title: MEDIUM, part: 1 }],
  ["combo, long title", { ...base, title: LONG, part: 1 }],
  ["combo, over the 70-char budget", { ...base, title: OVER, part: 1 }],
  ["combo, light mode", { ...base, title: MEDIUM, part: 1, mode: "light" }],
  ["combo, no part number", { title: MEDIUM, accent: "#2a9d8f" }],
  ["number-only", { ...base, title: MEDIUM, part: 3, style: "number-only" }],
  ["accent-block", { ...base, title: MEDIUM, style: "accent-block" }],
];
const social = [["social dossier", { ...base, title: MEDIUM, part: 1, size: "social", dek: "A short dek that explains the piece in one line." }]];
if (image) {
  covers.push(["combo + photo", { ...base, title: MEDIUM, part: 1, image }]);
  covers.push(["number-only + photo", { ...base, title: MEDIUM, part: 3, style: "number-only", image }]);
  social.push(["social photo-forward", { ...base, title: MEDIUM, size: "social", socialStyle: "photo-forward", image }]);
}

async function render(query) {
  let status, body;
  await handler({ query }, { setHeader() {}, status(c) { status = c; return this; }, send(b) { body = b; } });
  if (status !== 200) throw new Error(`render failed (status ${status}) — check the log above`);
  return body;
}

const widths = [286, 150, 90];
const pad = 14;
const rowH = Math.round((286 * 675) / 1200) + pad;
const composites = [];

for (const [i, [name, query]] of covers.entries()) {
  const buf = await render(query);
  fs.writeFileSync(path.join(outDir, `${String(i + 1).padStart(2, "0")}-${name.replace(/\W+/g, "-")}.webp`), buf);
  let x = pad;
  for (const w of widths) {
    composites.push({ input: await sharp(buf).resize(w).png().toBuffer(), left: x, top: pad + i * rowH });
    x += w + pad;
  }
  console.log(`row ${i + 1}: ${name}`);
}
for (const [name, query] of social) {
  fs.writeFileSync(path.join(outDir, `${name.replace(/\W+/g, "-")}.webp`), await render(query));
  console.log(`(full-size only): ${name}`);
}

await sharp({
  create: { width: widths.reduce((a, b) => a + b + pad, pad), height: rowH * covers.length + pad, channels: 3, background: "#808080" },
})
  .composite(composites)
  .png()
  .toFile(path.join(outDir, "sheet.png"));

console.log(`\nDone → ${path.relative(process.cwd(), outDir) || "."}/sheet.png (columns: 286px, 150px, 90px wide)`);
