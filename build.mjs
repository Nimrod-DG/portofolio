// Inlines optimized screenshots into the page as data URIs and writes
// index.html. The artifact CSP blocks every external host, so images cannot
// be linked — they have to be embedded.
//
//   node optimize.mjs && node build.mjs
import { readFileSync, writeFileSync, statSync } from "fs";
import sharp from "sharp";

const TEMPLATE = "./src/page.html";
const OUT = "./index.html";
const SHOTS = "./shots/opt";

let html = readFileSync(TEMPLATE, "utf8");

// Intrinsic sizes for every image the template references. These become
// width/height attributes below, and they are not cosmetic: without them a
// lazy image occupies zero height until it decodes, so the document keeps
// growing under a smooth scroll and an in-page anchor lands thousands of
// pixels short of its section. Read from the file rather than written by hand,
// so re-cropping a shot in optimize.mjs cannot leave a stale number here.
const sizes = {};
for (const name of new Set(
  [...html.matchAll(/\{\{IMG:([a-z0-9-]+)\}\}/gi)].map((m) => m[1])
)) {
  const meta = await sharp(`${SHOTS}/${name}.jpg`).metadata();
  sizes[name] = { w: meta.width, h: meta.height };
}

let count = 0;
let sized = 0;

// Pass 1: whole <img> tags, so width/height can be injected alongside the src.
html = html.replace(
  /<img\s([^>]*?)src="\{\{IMG:([a-z0-9-]+)\}\}"([^>]*?)>/gi,
  (_m, pre, name, post) => {
    const b64 = readFileSync(`${SHOTS}/${name}.jpg`).toString("base64");
    count++;
    const attrs = `${pre}${post}`;
    // Never fight an explicit width/height already in the template.
    const dim = /\bwidth=/i.test(attrs)
      ? ""
      : ((sized++), ` width="${sizes[name].w}" height="${sizes[name].h}"`);
    return `<img ${pre}src="data:image/jpeg;base64,${b64}"${dim}${post}>`;
  }
);

// Pass 2: any remaining token (a CSS url(), say) still resolves.
html = html.replace(/\{\{IMG:([a-z0-9-]+)\}\}/gi, (_m, name) => {
  count++;
  return `data:image/jpeg;base64,${readFileSync(`${SHOTS}/${name}.jpg`).toString("base64")}`;
});

const missing = html.match(/\{\{[^}]+\}\}/g);
if (missing) {
  console.error("unresolved tokens:", [...new Set(missing)].join(", "));
  process.exit(1);
}

writeFileSync(OUT, html);
console.log(
  `inlined ${count} images (${sized} given intrinsic size) -> ${OUT} (${(statSync(OUT).size / 1024).toFixed(0)}KB)`
);
