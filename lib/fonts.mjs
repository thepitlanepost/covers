import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

// IMPORTANT: these paths are written out literally, not built from a variable
// (e.g. `@fontsource/${pkg}/...`). Vercel's Node file tracer (@vercel/nft)
// decides what to bundle with the serverless function by statically analyzing
// fs.readFileSync calls — it's reliable with literal strings and unreliable
// with computed ones. If this ever gets refactored into a loop or a helper
// that builds the path dynamically, add the font files to vercel.json's
// includeFiles instead (already done, see vercel.json) so it still works.

export const fonts = [
  {
    name: "Aileron",
    weight: 400,
    style: "normal",
    data: fs.readFileSync(path.join(root, "node_modules/@fontsource/aileron/files/aileron-latin-400-normal.woff")),
  },
  {
    name: "Aileron",
    weight: 800,
    style: "normal",
    data: fs.readFileSync(path.join(root, "node_modules/@fontsource/aileron/files/aileron-latin-800-normal.woff")),
  },
  {
    name: "Mozilla Text",
    weight: 400,
    style: "normal",
    data: fs.readFileSync(path.join(root, "node_modules/@fontsource/mozilla-text/files/mozilla-text-latin-400-normal.woff")),
  },
];
