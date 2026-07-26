// Inlines optimized screenshots into the page as data URIs and writes
// index.html. The artifact CSP blocks every external host, so images cannot
// be linked — they have to be embedded.
//
//   node optimize.mjs && node build.mjs
import { readFileSync, writeFileSync, statSync } from "fs";

const TEMPLATE = "./src/page.html";
const OUT = "./index.html";
const SHOTS = "./shots/opt";

let html = readFileSync(TEMPLATE, "utf8");

let count = 0;
html = html.replace(/\{\{IMG:([a-z0-9-]+)\}\}/gi, (_m, name) => {
  const b64 = readFileSync(`${SHOTS}/${name}.jpg`).toString("base64");
  count++;
  return `data:image/jpeg;base64,${b64}`;
});

const missing = html.match(/\{\{[^}]+\}\}/g);
if (missing) {
  console.error("unresolved tokens:", [...new Set(missing)].join(", "));
  process.exit(1);
}

writeFileSync(OUT, html);
console.log(`inlined ${count} images -> ${OUT} (${(statSync(OUT).size / 1024).toFixed(0)}KB)`);
