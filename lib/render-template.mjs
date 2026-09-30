// Turns templates/*.html + templates/covers.css into the element tree Satori
// wants. Exists because Satori only understands *inline* styles (no class
// selectors, no <style> tags, no CSS variables), but nobody wants to hand-edit
// a 200-character style="" string. So: you write normal HTML + CSS, and this
// file inlines the CSS at render time.
//
// What it does, in order:
//   1. {{#flag}}...{{/flag}} / {{^flag}}...{{/flag}} sections are kept or
//      dropped depending on whether data[flag] is truthy (no nesting limits,
//      but no loops either).
//   2. The HTML is parsed and covers.css is applied: every rule whose selector
//      matches an element gets merged into that element's style="" (normal
//      cascade: specificity, then source order, then the element's own style).
//   3. CSS custom properties work: they inherit down the tree and var(--x) /
//      var(--x, fallback) is resolved here (Satori can't do it itself).
//      Values that change per request (--accent, --title-size, ...) are passed
//      in as `vars` and set on the root element.
//   4. {{name}} placeholders are filled in AFTER parsing, straight into the
//      tree. That's deliberate: user text never goes through an HTML parser
//      (so `<`, `&`, quotes in a title are harmless), and the multi-hundred-KB
//      image data URI never goes through satori-html's parser (which is
//      super-linear in attribute size — see the note in api/cover.js).
//
// Deliberately NOT supported (throws a clear error): @media/@font-face/@import
// and any other at-rule, nested rules, !important.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { html } from "satori-html";
import { parse, renderSync, ELEMENT_NODE } from "ultrahtml";
import { querySelectorAll } from "ultrahtml/selector";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

// IMPORTANT: paths are literal strings, not built in a loop — same reason as
// lib/fonts.mjs (Vercel's file tracer follows literal fs.readFileSync calls).
// Adding a template = add a line here.
const STYLESHEET = fs.readFileSync(path.join(root, "templates/covers.css"), "utf8");
const TEMPLATES = {
  "combo": fs.readFileSync(path.join(root, "templates/combo.html"), "utf8"),
  "number-only": fs.readFileSync(path.join(root, "templates/number-only.html"), "utf8"),
  "accent-block": fs.readFileSync(path.join(root, "templates/accent-block.html"), "utf8"),
  "social-dossier": fs.readFileSync(path.join(root, "templates/social-dossier.html"), "utf8"),
  "social-photo-forward": fs.readFileSync(path.join(root, "templates/social-photo-forward.html"), "utf8"),
};

// ---------------------------------------------------------------------------
// CSS parsing (just enough for flat, single-level rules)
// ---------------------------------------------------------------------------

function specificity(selector) {
  const s = selector.replace(/\([^)]*\)/g, "");
  const ids = (s.match(/#[\w-]+/g) || []).length;
  const classes = (s.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) || []).length;
  const tags = (s.match(/(^|[\s>+~])[a-zA-Z][\w-]*/g) || []).length;
  return ids * 100 + classes * 10 + tags;
}

function parseStylesheet(source) {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  const leftover = text.replace(ruleRe, "").trim();
  if (leftover) throw new Error(`covers.css: couldn't parse near "${leftover.slice(0, 60)}" (nested rules and stray braces aren't supported)`);

  const emptyDoc = parse("<div></div>");
  const rules = [];
  let order = 0;
  for (const [, selectorList, body] of text.matchAll(ruleRe)) {
    const decls = parseDeclarations(body, `rule "${selectorList.trim()}"`);
    for (const selector of selectorList.split(",").map((s) => s.trim()).filter(Boolean)) {
      if (selector.startsWith("@")) throw new Error(`covers.css: at-rules (${selector.split(/\s/)[0]}) aren't supported`);
      if (selector !== ":root") {
        try { querySelectorAll(emptyDoc, selector); }
        catch (err) { throw new Error(`covers.css: unsupported selector "${selector}" — ${err.message}`); }
      }
      rules.push({ selector, decls, specificity: specificity(selector), order: order++ });
    }
  }
  return rules;
}

function parseDeclarations(body, where) {
  const out = [];
  for (const raw of body.split(";")) {
    const decl = raw.trim();
    if (!decl) continue;
    const i = decl.indexOf(":");
    if (i === -1) throw new Error(`covers.css: bad declaration "${decl}" in ${where}`);
    const prop = decl.slice(0, i).trim();
    const value = decl.slice(i + 1).trim();
    if (/!important/i.test(value)) throw new Error(`covers.css: !important isn't supported ("${decl}")`);
    out.push([prop, value]);
  }
  return out;
}

const RULES = parseStylesheet(STYLESHEET);

// ---------------------------------------------------------------------------
// var() resolution
// ---------------------------------------------------------------------------

function topLevelComma(s) {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") depth--;
    else if (s[i] === "," && depth === 0) return i;
  }
  return -1;
}

function replaceVars(str, vars, seen = []) {
  let out = str;
  let i;
  while ((i = out.indexOf("var(")) !== -1) {
    let depth = 0;
    let j = i + 3;
    for (; j < out.length; j++) {
      if (out[j] === "(") depth++;
      else if (out[j] === ")" && --depth === 0) break;
    }
    if (j >= out.length) throw new Error(`covers.css: unbalanced var() in "${str}"`);
    const inner = out.slice(i + 4, j);
    const comma = topLevelComma(inner);
    const name = (comma === -1 ? inner : inner.slice(0, comma)).trim();
    const fallback = comma === -1 ? undefined : inner.slice(comma + 1).trim();

    let value;
    if (name in vars) {
      if (seen.includes(name)) throw new Error(`covers.css: circular variable ${name}`);
      value = replaceVars(vars[name], vars, [...seen, name]);
    } else if (fallback !== undefined) {
      value = replaceVars(fallback, vars, seen);
    } else {
      throw new Error(`covers.css: variable ${name} isn't defined (used in "${str}")`);
    }
    out = out.slice(0, i) + value + out.slice(j + 1);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function resolveSections(source, data) {
  const re = /\{\{([#^])(\w+)\}\}([\s\S]*?)\{\{\/\2\}\}/g;
  let prev;
  let out = source;
  do {
    prev = out;
    out = out.replace(re, (_, kind, key, body) => (Boolean(data[key]) === (kind === "#") ? body : ""));
  } while (out !== prev);
  return out;
}

function inlineStyles(node, inherited, ctx) {
  if (node.type !== ELEMENT_NODE) return;

  const matched = (ctx.matched.get(node) || []).sort((a, b) => a.specificity - b.specificity || a.order - b.order);
  const style = {};
  const custom = {};
  const put = ([prop, value]) => (prop.startsWith("--") ? custom : style)[prop] = value;

  for (const rule of matched) rule.decls.forEach(put);
  if (node.attributes.style) parseDeclarations(node.attributes.style, "an inline style attribute").forEach(put);
  if (node === ctx.rootEl) {
    for (const [k, v] of Object.entries(ctx.vars)) custom[`--${k}`] = String(v);
    style.width = `${ctx.width}px`;
    style.height = `${ctx.height}px`;
  }

  const vars = { ...inherited, ...custom };
  const resolved = Object.entries(style).map(([prop, value]) => `${prop}:${replaceVars(value, vars)}`);
  delete node.attributes.class;
  if (resolved.length) node.attributes.style = resolved.join(";");
  else delete node.attributes.style;

  for (const child of node.children || []) inlineStyles(child, vars, ctx);
}

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

function fill(str, data) {
  // function replacer on purpose: titles containing "$&" etc. must stay literal
  return str.replace(PLACEHOLDER, (_, key) => {
    if (!(key in data)) throw new Error(`template placeholder {{${key}}} has no value — pass it in \`data\``);
    return data[key] == null ? "" : String(data[key]);
  });
}

function fillTree(node, data) {
  if (Array.isArray(node)) return node.map((n) => fillTree(n, data));
  if (typeof node === "string") return fill(node, data);
  if (node && typeof node === "object" && node.props) {
    for (const [key, value] of Object.entries(node.props)) {
      if (key === "style") continue;
      if (key === "children") node.props.children = fillTree(value, data);
      else if (typeof value === "string") node.props[key] = fill(value, data);
    }
  }
  return node;
}

/**
 * @param {string} name        key of TEMPLATES (file name without .html)
 * @param {object} opts
 * @param {number} opts.width  canvas width  — set on the root element
 * @param {number} opts.height canvas height — set on the root element
 * @param {object} opts.vars   per-request CSS custom properties, WITHOUT the
 *                             leading dashes: { accent: "#e10600", "title-size": "96px" }
 * @param {object} opts.data   values for {{placeholders}} and {{#sections}}
 */
export function renderTemplate(name, { width, height, vars = {}, data = {} }) {
  const source = TEMPLATES[name];
  if (!source) throw new Error(`unknown template "${name}"`);

  const withoutComments = source.replace(/<!--[\s\S]*?-->/g, "");
  const doc = parse(resolveSections(withoutComments, data));
  const rootEl = doc.children.find((n) => n.type === ELEMENT_NODE);
  if (!rootEl) throw new Error(`template "${name}" has no root element`);

  const matched = new Map();
  for (const rule of RULES) {
    const nodes = rule.selector === ":root" ? [rootEl] : querySelectorAll(doc, rule.selector);
    for (const node of nodes) {
      if (!matched.has(node)) matched.set(node, []);
      matched.get(node).push(rule);
    }
  }

  inlineStyles(rootEl, {}, { matched, rootEl, vars, width, height });
  return fillTree(html(renderSync(doc)), data);
}
