// Resize + recompress the raw Playwright captures so they can be inlined as
// data URIs without bloating the page. Run after re-capturing screenshots.
//   node optimize.mjs
import sharp from "sharp";
import { mkdirSync } from "fs";

const SRC = "./shots";
const DST = "./shots/opt";
mkdirSync(DST, { recursive: true });

// name -> optional crop (fraction of height to keep from the top)
const PLAN = {
  "01-landing": 1,
  "02-home": 1,
  "11-register-1": 0.82, // trim the fold; the stepper is the point
  // These two sit side by side in a grid, so they are cropped to the SAME
  // fraction — matching aspect ratios are what make the pair align.
  "05-discovery-meets": 0.62,
  "06-profile": 0.62,
  "08-club": 1,
  "10-create-meet": 1,
  "09-meet": 1,
  "17-meet-slotmarket": 1,
};

for (const [name, keep] of Object.entries(PLAN)) {
  const input = `${SRC}/${name}.jpg`;
  let img = sharp(input);
  const meta = await img.metadata();

  if (keep < 1) {
    img = img.extract({
      left: 0,
      top: 0,
      width: meta.width,
      height: Math.round(meta.height * keep),
    });
  }

  const out = `${DST}/${name}.jpg`;
  const info = await img
    .resize({ width: 1400, withoutEnlargement: true })
    .jpeg({ quality: 64, mozjpeg: true })
    .toFile(out);

  console.log(
    `${name.padEnd(20)} ${String(meta.width).padStart(4)}px -> ${String(info.width).padStart(4)}px  ${(info.size / 1024).toFixed(0)}KB`
  );
}
console.log("optimized -> shots/opt");
