// Screenshots for the mini-erp case study.
//
//   cd D:\Work\mini-erp && make dev      (api :8080, web :5173)
//   node capture-erp.mjs                 all shots
//   node capture-erp.mjs 01 05 22        just those
//
// Shots are grouped into sessions, one per (account × viewport × theme), because
// signing in is real Firebase and costs a second or two — doing it once per shot
// would triple the run. Sessions run in the order declared, and that order is
// load-bearing: everything up to and including the mobile session reads, and only
// then does `post-receipt` write. Capture #01 posts a real goods receipt.
//
// Theme comes from the context's `colorScheme`, not from clicking the toggle: the
// app's preference defaults to "system" and a fresh context has an empty
// localStorage, so the emulated preference decides — deterministically.
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = "http://localhost:5173";
const PASSWORD = "password123";
const OUT = "./shots";

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 360, height: 780 };

const ACCOUNTS = {
  rina: "rina@nusantara.test", // Nusantara admin — sees everything
  budi: "budi@nusantara.test", // procurement approver
  sari: "sari@nusantara.test", // procurement user
  dewi: "dewi@nusantara.test", // finance admin
  agus: "agus@bahari.test", // Bahari admin — no Finance entitlement
  super: "super@erp.test", // platform superadmin
};

// Filled in by resolveIds() during the first session and logged, so a rerun is
// reproducible. Seeded UUIDs are UUIDv5 derived from what the row *is*
// (backend/cmd/seed/ids.go), so these survive a reseed — they are resolved by
// navigating rather than hardcoded so the script survives a *reshaped* seed too.
const ids = {};

const only = process.argv.slice(2);
const wanted = (n) => only.length === 0 || only.includes(n);

mkdirSync(OUT, { recursive: true });

/* ---------------------------------------------------------------- helpers */

async function settle(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await page.waitForTimeout(300);
}

async function shoot(page, name) {
  await settle(page);
  const file = `${OUT}/erp-${name}.jpg`;
  await page.screenshot({ path: file, quality: 92, type: "jpeg" });
  console.log(`  ✓ erp-${name}`);
}

async function go(page, path, { wait = "h1" } = {}) {
  await page.goto(`${BASE}${path}`);
  if (wait) await page.waitForSelector(wait, { timeout: 30000 });
  await settle(page);
}

async function signIn(page, email) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  // Wait on the post-login state, never a fixed timeout: sign-in is a real
  // network round trip to Firebase and then to /api/me. Waiting on the sidebar
  // would hang at 360px — the shell still renders it, inside a closed drawer, so
  // it is present but never visible. The redirect off /login plus the shell's
  // own <h1> holds at every width.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 45000,
  });
  await page.waitForSelector("h1", { state: "visible", timeout: 45000 });
  await settle(page);
}

/** The href under `prefix` whose row mentions `text` — resolves a document
 *  number or an SKU to the id in its link, so nothing is hardcoded. */
async function hrefFor(page, prefix, text) {
  const href = await page.$$eval(
    `a[href^="${prefix}"]`,
    (as, t) => {
      const hit = as.find((a) => a.textContent.includes(t));
      return hit ? hit.getAttribute("href") : null;
    },
    text,
  );
  if (!href) throw new Error(`no link under ${prefix} mentioning "${text}"`);
  return href;
}

const idFrom = (href) => href.split("/").pop();

async function resolveIds(page) {
  await go(page, "/procurement/orders");
  // Partly received (70 of 200): every screen in the receipt story then shows a
  // *derived* received quantity rather than a row of zeroes.
  ids.po = idFrom(await hrefFor(page, "/procurement/orders/", "PO-202606-0001"));

  await go(page, "/procurement/requisitions");
  ids.requisition = idFrom(
    await hrefFor(page, "/procurement/requisitions/", "PR-202607-0008"),
  );

  await go(page, "/inventory/products");
  ids.product = idFrom(
    await hrefFor(page, "/inventory/products/", "HND-TROLLEY"),
  );
  // Two products below their reorder point, for the low-stock prefill on #03.
  ids.lowStock = [
    idFrom(await hrefFor(page, "/inventory/products/", "PKG-TAPE")),
    idFrom(await hrefFor(page, "/inventory/products/", "PKG-BOX-S")),
  ];

  await go(page, "/settings/users");
  // Budi's matrix is the interesting one: approver in procurement, viewer in
  // inventory, nothing in finance — three different levels in one screenshot.
  // The row's link wraps the name only — the email sits outside it.
  ids.user = idFrom(await hrefFor(page, "/settings/users/", "Budi Santoso"));

  console.log("resolved ids:", JSON.stringify(ids, null, 2));
}

/* ----------------------------------------------------------------- shots */

const sessions = [
  {
    name: "rina · desktop",
    account: "rina",
    viewport: DESKTOP,
    scheme: "dark",
    setup: resolveIds,
    shots: {
      "02-requisitions": (p) => go(p, "/procurement/requisitions"),
      "05-orders": (p) => go(p, "/procurement/orders"),
      "06-order-detail": (p) => go(p, `/procurement/orders/${ids.po}`),
      "07-receive-form": (p) => go(p, `/procurement/orders/${ids.po}/receive`),
      "08-suppliers": (p) => go(p, "/procurement/suppliers"),
      "09-stock": (p) => go(p, "/inventory/stock"),
      "10-ledger": (p) => go(p, "/inventory/ledger"),
      "12-products": (p) => go(p, "/inventory/products"),
      "13-product-detail": (p) => go(p, `/inventory/products/${ids.product}`),
      "14-warehouses": (p) => go(p, "/inventory/warehouses"),
      "19-users": (p) => go(p, "/settings/users"),
      "20-user-roles": (p) => go(p, `/settings/users/${ids.user}`),
    },
  },

  {
    name: "sari · new requisition",
    account: "sari",
    viewport: DESKTOP,
    scheme: "dark",
    shots: {
      // `?products=` is the dashboard's real low-stock shortcut, so the form
      // arrives with lines in it rather than one empty row.
      "03-requisition-new": async (p) => {
        await go(
          p,
          `/procurement/requisitions/new?products=${ids.lowStock[0]}:60,${ids.lowStock[1]}:120`,
        );
        await p.getByLabel("Deliver to").selectOption({ index: 1 });
        await p.getByLabel("Supplier").selectOption({ index: 1 });
        await settle(p);
      },
    },
  },

  {
    name: "budi · approver",
    account: "budi",
    viewport: DESKTOP,
    scheme: "dark",
    shots: {
      "04-requisition-detail": (p) =>
        go(p, `/procurement/requisitions/${ids.requisition}`),
      "22-dashboard": (p) => go(p, "/"),
    },
  },

  {
    name: "dewi · finance",
    account: "dewi",
    viewport: DESKTOP,
    scheme: "dark",
    shots: { "15-finance": (p) => go(p, "/finance") },
  },

  {
    name: "agus · Bahari, no Finance",
    account: "agus",
    viewport: DESKTOP,
    scheme: "dark",
    shots: { "21-sidebar-no-finance": (p) => go(p, "/") },
  },

  {
    name: "superadmin",
    account: "super",
    viewport: DESKTOP,
    scheme: "dark",
    shots: {
      "17-tenants": (p) => go(p, "/admin/tenants"),
      "18-tenant-entitlements": async (p) => {
        await go(p, "/admin/tenants");
        const href = await hrefFor(p, "/admin/tenants/", "Bahari");
        await go(p, href);
      },
    },
  },

  {
    // Budi, not Rina: #27 is meant to sit beside #22 and show *only* the theme
    // changing. A different account would change the greeting, the widgets and
    // the sidebar too, and the pair would stop being a comparison.
    name: "budi · light",
    account: "budi",
    viewport: DESKTOP,
    scheme: "light",
    shots: { "27-dashboard-light": (p) => go(p, "/") },
  },

  {
    name: "rina · phone",
    account: "rina",
    viewport: MOBILE,
    scheme: "dark",
    shots: {
      "24-mobile-dashboard": (p) => go(p, "/"),
      "25-mobile-requisitions": (p) => go(p, "/procurement/requisitions"),
      // The line table is wider than a phone and scrolls inside its own
      // container, so at rest the two columns that matter — outstanding, and the
      // box you type into — sit off-screen to the right. Nudge that container
      // over far enough to bring them into frame while the product is still
      // readable; the sticky Post receipt bar is fixed and stays put regardless.
      "26-mobile-receive": async (p) => {
        await go(p, `/procurement/orders/${ids.po}/receive`);
        await p.$eval(
          "section.overflow-x-auto",
          (el) => (el.scrollLeft = el.scrollWidth - el.clientWidth),
        );
        await settle(p);
      },
    },
  },

  {
    name: "signed out",
    viewport: DESKTOP,
    scheme: "dark",
    shots: {
      "23-login": (p) => go(p, "/login", { wait: 'input[type="email"]' }),
    },
  },

  // ---- everything below here writes to the database ----------------------
  {
    name: "rina · post the receipt",
    account: "rina",
    viewport: DESKTOP,
    scheme: "dark",
    shots: {
      "01-receipt-confirmation": async (p) => {
        await go(p, `/procurement/orders/${ids.po}/receive`);

        // Each box is pre-filled with the line's full outstanding quantity. Leave
        // the last line whole and cut the first one down, so the receipt covers
        // more than one line — two ledger rows in the confirmation reads better
        // than one — while the order stays *partly* received afterwards.
        const boxes = await p.$$('input[aria-label^="Quantity received"]');
        console.log(`  ${boxes.length} outstanding line(s) on the order`);
        if (boxes.length > 1) await boxes[0].fill("30");

        await p.getByRole("button", { name: "Post receipt" }).click();

        // The confirmation panel replaces the form. Wait for the link it draws to
        // the ledger — that is also where the receipt id comes from.
        const link = await p.waitForSelector(
          'a[href^="/inventory/ledger?sourceId="]',
          { timeout: 30000 },
        );
        const href = await link.getAttribute("href");
        ids.receipt = new URL(href, BASE).searchParams.get("sourceId");
        console.log(`  receipt ${ids.receipt}`);

        // Let the "posted" toast expire rather than shoot over the panel.
        await p.waitForTimeout(6000);
      },
      "11-ledger-filtered": (p) =>
        go(p, `/inventory/ledger?sourceId=${ids.receipt}`),
    },
  },

  {
    name: "dewi · the other half of the pair",
    account: "dewi",
    viewport: DESKTOP,
    scheme: "dark",
    shots: {
      "16-finance-filtered": (p) => go(p, `/finance?sourceId=${ids.receipt}`),
    },
  },
];

/* ------------------------------------------------------------------- run */

const browser = await chromium.launch();

for (const session of sessions) {
  const todo = Object.entries(session.shots).filter(([name]) =>
    wanted(name.slice(0, 2)),
  );
  // Session 1 also resolves the ids every later session needs, so it runs even
  // when none of its own shots were asked for.
  if (todo.length === 0 && !session.setup) continue;

  console.log(`\n${session.name}`);
  const context = await browser.newContext({
    viewport: session.viewport,
    deviceScaleFactor: 2,
    colorScheme: session.scheme,
  });
  const page = await context.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") console.log("    [console]", m.text());
  });
  // Deterministic frames: no half-finished transition, no blinking caret.
  await page.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent =
      "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important}";
    document.addEventListener("DOMContentLoaded", () =>
      document.head.append(css),
    );
  });

  if (session.account) await signIn(page, ACCOUNTS[session.account]);
  if (session.setup) await session.setup(page);

  for (const [name, step] of todo) {
    try {
      await step(page);
      await shoot(page, name);
    } catch (err) {
      console.log(`  ✗ erp-${name}: ${err.message}`);
    }
  }

  await context.close();
}

await browser.close();
console.log("\ndone -> shots/");
