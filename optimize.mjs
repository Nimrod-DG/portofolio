// Resize + recompress the raw Playwright captures so they can be inlined as
// data URIs without bloating the page. Run after re-capturing screenshots.
//   node optimize.mjs
import sharp from "sharp";
import { mkdirSync, readFileSync } from "fs";

const SRC = "./shots";
const DST = "./shots/opt";
mkdirSync(DST, { recursive: true });

// name -> optional crop (fraction of height to keep from the top)
const PLAN = {
  // ---- LW Sports ---------------------------------------------------------
  // Hand-set, and they stay hand-set: that application is not being recaptured,
  // so there is nothing to measure them against.
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

// ---- mini-erp ------------------------------------------------------------
// These are not written here at all. `capture-erp.mjs` measures where the
// content stops on each screen as it takes the shot and writes the fractions to
// shots/crop-erp.json, because an ERP screen is mostly table and the stopping
// point moves whenever the page size, the filter row or the pagination bar
// changes. Hand-tuned numbers survived exactly one UI pass before every one of
// them was wrong — some clipping a table, most leaving dead canvas.
const measured = JSON.parse(readFileSync(`${SRC}/crop-erp.json`, "utf8"));

// Shots that sit side by side in a .shot-grid must be cropped to the SAME
// fraction — matching aspect ratios are the only thing making the two frames
// line up. The taller of the group wins, so nothing in it is clipped.
const GROUPS = [
  ["erp-05-orders", "erp-06-order-detail"],
  ["erp-09-stock", "erp-10-ledger"],
  // the two halves of the confirmation panel's links
  ["erp-11-ledger-filtered", "erp-16-finance-filtered"],
  // the same screen, dark and light
  ["erp-22-dashboard", "erp-27-dashboard-light"],
  ["erp-29-filter-open", "erp-30-account-menu"],
  // the phone grid
  [
    "erp-24-mobile-dashboard",
    "erp-25-mobile-requisitions",
    "erp-26-mobile-receive",
    "erp-31-mobile-filters",
  ],
];

// Floors, for the one shot whose crop is not about its content. #01 is also the
// project card's thumbnail, and that thumbnail is a 16/9 box with
// object-fit:cover — cropped tighter than 16/9 the image is wider than the box,
// so cover trims the sides and eats the sidebar. 0.88 lands just past 16/9: the
// card shows the full width, at the price of some quiet canvas under the hero.
const FLOORS = { "erp-01-receipt-confirmation": 0.88 };

for (const [name, keep] of Object.entries(measured)) {
  PLAN[name] = Math.max(keep, FLOORS[name] ?? 0);
}
for (const group of GROUPS) {
  const present = group.filter((name) => name in PLAN);
  if (present.length === 0) continue;
  const tallest = Math.max(...present.map((name) => PLAN[name]));
  for (const name of present) PLAN[name] = tallest;
}

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
    `${name.padEnd(30)} keep ${keep.toFixed(2)}  ${String(meta.width).padStart(4)}px -> ${String(info.width).padStart(4)}px  ${(info.size / 1024).toFixed(0)}KB`
  );
}
console.log("optimized -> shots/opt");
