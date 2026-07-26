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
  // ---- LW Sports ---------------------------------------------------------
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

  // ---- mini-erp ----------------------------------------------------------
  // Fractions are measured, not guessed: an ERP screen is mostly table, so
  // where the content stops varies enormously between a nine-row list and a
  // two-line filtered result. Anything left below that point is dead canvas
  // that makes the figure look empty in the page.
  //
  // Where two shots are paired in a .shot-grid they carry the SAME fraction,
  // marked below — that is the only thing making the two frames line up.
  // 0.88, not the 0.69 where the content actually stops: this shot is also the
  // project card's thumbnail, and that thumbnail is a 16/9 box with
  // object-fit:cover. Cropped tighter than 16/9 the image is wider than the box,
  // so cover trims the sides and eats the sidebar. 0.88 lands just past 16/9 —
  // the card shows the full width, at the price of some quiet canvas under the
  // hero figure.
  "erp-01-receipt-confirmation": 0.88,
  "erp-02-requisitions": 1,
  "erp-03-requisition-new": 0.95,
  "erp-04-requisition-detail": 0.62,
  "erp-05-orders": 0.86, // pair ─┐
  "erp-06-order-detail": 0.86, //  ─┘
  "erp-07-receive-form": 0.57,
  "erp-08-suppliers": 0.73,
  "erp-09-stock": 1, // pair ─┐
  "erp-10-ledger": 1, //     ─┘
  "erp-11-ledger-filtered": 0.6, // pair ─┐  the two halves of the
  "erp-12-products": 0.88, //             │  confirmation panel's links
  "erp-13-product-detail": 1, //          │
  "erp-14-warehouses": 0.5, //            │
  "erp-15-finance": 0.74, //              │
  "erp-16-finance-filtered": 0.6, //     ─┘
  "erp-17-tenants": 0.48,
  "erp-18-tenant-entitlements": 1,
  "erp-19-users": 0.64,
  "erp-20-user-roles": 1,
  "erp-21-sidebar-no-finance": 1,
  "erp-22-dashboard": 1, // pair ─┐ dark / light, same screen
  "erp-23-login": 0.56, //        │
  "erp-24-mobile-dashboard": 1, //│
  "erp-25-mobile-requisitions": 1, //
  "erp-26-mobile-receive": 1, //  │
  "erp-27-dashboard-light": 1, // ─┘
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
