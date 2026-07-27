# Plan — add mini-erp as the second portfolio case study

**Written 2026-07-27, to be executed in a fresh session.** Everything needed is
in this file; you do not need the conversation that produced it.

Two repositories are involved:

| | |
|---|---|
| **This one** — `D:\Work\lw-sports-portfolio` (`Nimrod-DG/portofolio`, branch `main`) | Where the work happens. A single-page static portfolio |
| **`D:\Work\mini-erp`** (`Nimrod-DG/mini-erp`, branch `master`) | The project being written up. Read-only for this task, except its `docs/PROGRESS.md` |

---

## 0. What mini-erp is, in one paragraph

A multi-tenant ERP: procurement → inventory → finance, built as a modular
monolith. Go/Fiber + PostgreSQL with row-level security, React/TypeScript
frontend, Firebase Authentication. Tenant isolation is enforced by the database
rather than by application code — every tenant-scoped query runs inside a
transaction that has set `app.current_tenant`, and fourteen tables carry
`FORCE ROW LEVEL SECURITY` with an isolation policy. The headline feature is a
single atomic transaction that spans three modules: posting a goods receipt
writes the receipt, the stock ledger rows, and a balanced journal entry, or none
of them.

**Say "modular monolith", never "microservices"** — splitting the frontend from
the backend is deployment topology, not service decomposition. The monolith is
the point: that atomic cross-module write is exactly what microservices would
have cost. **Never describe Go as "encrypted"** — binaries are compiled, and Go
decompiles comparatively easily. The defensible claims are memory safety, a
small container attack surface, and static typing.

Full technical background: `D:\Work\mini-erp\docs\PROGRESS.md` (long — read the
"Current state" block and the Phase 5–9 logs), `docs/00-scope.md`, and
`docs/decisions/`.

---

## 1. Deployment status — the exact wording to use

**Deploy-ready, not deployed.** Be straightforward about it; it reads better
than a vague "coming soon", and the reason is not an engineering failure.

What is true as of 2026-07-27:

- **Database is live** — Neon Postgres 17 in Singapore. Schema migrated, demo
  data seeded, and an invariant checker (`cmd/dbverify`) passes all 11 checks
  against it, including that no application role holds `BYPASSRLS`.
- **Frontend is live** on Firebase Hosting at `https://erp-project-b66ce.web.app`
  — but it points at a placeholder API URL, so it stops at the login screen.
  **Do not link it as "Live"**; it would read as broken.
- **Backend is not deployed.** The container builds and runs, and both a Cloud
  Run and a Render deployment are fully configured in the repo
  (`deploy/deploy-api.sh`, `render.yaml`). Both hosts require a verified payment
  method, and the developer's Indonesian debit card is rejected by Google and by
  Stripe.

Suggested phrasing for the case study's status section — adapt, don't paste:

> The database is live and the container is proven; the API is not hosted. Both
> a Cloud Run and a Render deployment are configured and committed, and each
> stops at the same place — a card verification that an Indonesian debit card
> does not pass. The screenshots below are the application running locally
> against the same seeded dataset that is in the production database.

Link the **GitHub repository** instead of a live URL:
`https://github.com/Nimrod-DG/mini-erp`. In the header nav, the `.live` slot
should become a repo link for this project (see §4).

---

## 2. Capture the screenshots

Playwright and sharp are already dependencies of this repo. There is no capture
script — write one at `capture-erp.mjs`.

### 2.1 Get a clean local app running

In `D:\Work\mini-erp`. **Rebuild the database first** — the local one has been
walked on and holds leftover scratch rows (`SKU-001 Widget`, a `WH-1`
warehouse, two test accounts) that would show up in screenshots:

```bash
docker compose down -v
make up
make migrate
make seed
make dev          # api on :8080, web on :5173
```

`make seed` needs `backend/.env` and the Firebase service-account key, both of
which are already on the machine. It is idempotent and self-verifying.

### 2.2 The accounts

Password for every account is `password123`. Pick the account per shot so each
screen shows the most interesting state:

| Email | Who they are | Use them for |
|---|---|---|
| `rina@nusantara.test` | Nusantara tenant admin, implicit admin in all three modules | Most screens — she can see everything |
| `budi@nusantara.test` | staff · procurement **approver** | The dashboard approval queue with its two-button decision, and approving a requisition |
| `sari@nusantara.test` | staff · procurement **user** | Creating a requisition; also proves a user *cannot* approve |
| `dewi@nusantara.test` | staff · finance **admin**, procurement viewer | The finance screen |
| `agus@bahari.test` | Bahari tenant admin — **Bahari has no Finance entitlement** | The sidebar with Finance *absent*. This single shot proves the entitlement model |
| `super@erp.test` | platform superadmin, belongs to no tenant | `/admin/tenants` and the module entitlement matrix |

Nusantara is `Asia/Jakarta` with all three modules; Bahari is `Asia/Makassar`
with no Finance. That contrast is worth a sentence in the write-up.

### 2.3 The shot list

Name files `erp-NN-slug.jpg` in `shots/`. The `NN` ordering is only for humans;
`build.mjs` matches on the slug. **Capture at 1440×900 desktop unless noted.**

**The money shot — capture this one first and make sure it is good:**

| # | Route | Who | What must be visible |
|---|---|---|---|
| 01 | `/procurement/orders/:id/receive` → after posting | rina | **The §10.3 confirmation panel.** It names the receipt, the stock ledger rows, and the journal entry written in the *same transaction*, and links to both. This is the whole architectural argument in one screenshot — Phase 10 lists it as a completion criterion |

**Procurement:**

| # | Route | Who | Notes |
|---|---|---|---|
| 02 | `/procurement/requisitions` | rina | The list with status chips across draft/submitted/approved/rejected/cancelled |
| 03 | `/procurement/requisitions/new` | sari | The line-item form |
| 04 | `/procurement/requisitions/:id` | budi | An approved one, showing the approve/reject decision and the PO it produced |
| 05 | `/procurement/orders` | rina | Includes an overdue order and a partially-received one |
| 06 | `/procurement/orders/:id` | rina | Line-level received-vs-ordered — a *derived* quantity, never a stored counter |
| 07 | `/procurement/orders/:id/receive` | rina | The form *before* posting |
| 08 | `/procurement/suppliers` | rina | Master data list; one supplier is inactive |

**Inventory:**

| # | Route | Who | Notes |
|---|---|---|---|
| 09 | `/inventory/stock` | rina | Stock on hand — a view, computed from the ledger |
| 10 | `/inventory/ledger` | rina | The append-only movement history |
| 11 | `/inventory/ledger?sourceId=<receipt id>` | rina | The same list filtered to one receipt, reached from the confirmation panel. Pair it with #01 |
| 12 | `/inventory/products` | rina | Three products are below reorder point — make sure a reorder badge is in frame |
| 13 | `/inventory/products/:id` | rina | The edit form |
| 14 | `/inventory/warehouses` | rina | |

**Finance:**

| # | Route | Who | Notes |
|---|---|---|---|
| 15 | `/finance` | dewi | Journal entries **with their lines**, so a reader can see debits equal credits |
| 16 | `/finance?sourceId=<receipt id>` | dewi | The other half of the confirmation panel's pair |

**Tenants, users, permissions — the multi-tenancy story:**

| # | Route | Who | Notes |
|---|---|---|---|
| 17 | `/admin/tenants` | super@erp.test | Both workspaces |
| 18 | `/admin/tenants/:id` | super@erp.test | **The module entitlement matrix.** Bahari with Finance off is the shot to take |
| 19 | `/settings/users` | rina | The tenant's people and their roles |
| 20 | `/settings/users/:id` | rina | **The per-module role matrix** — module × level. This is the permission model made visible |
| 21 | `/` (dashboard) | agus | Sidebar with **no Finance link**, because Bahari is not entitled. Caption it explicitly |

**Dashboard and entry:**

| # | Route | Who | Notes |
|---|---|---|---|
| 22 | `/` | budi | All four widgets, including the approval queue with its two-button decision |
| 23 | `/login` | — | Low priority; include only if the case study needs an opening frame |

**Responsive and theme — three or four, not more:**

| # | What | Notes |
|---|---|---|
| 24 | `/` at **360px**, dark | The mobile tab bar |
| 25 | `/procurement/requisitions` at **360px** | The list becomes **cards**, not a squeezed table. Pair it with #02 to show the same screen both ways |
| 26 | `/procurement/orders/:id/receive` at **360px** | The sticky action bar — this is the one screen genuinely used on a phone |
| 27 | `/` desktop, **light mode** | Pair with #22 for the theme story |

### 2.4 Writing `capture-erp.mjs`

Sketch — adapt as needed:

```js
// node capture-erp.mjs    (app must be running: make dev in D:\Work\mini-erp)
import { chromium } from "playwright";

const BASE = "http://localhost:5173";
const PASSWORD = "password123";

async function signIn(page, email) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`);
}
```

Things that will bite:

- **Sign-in is real Firebase**, so it needs network and takes a second or two.
  Wait on a post-login element, not a fixed timeout.
- **Sign out between accounts**, or reuse a fresh browser context per account —
  the session persists in local storage.
- **Document IDs are stable across reseeds.** Every seeded row's UUID is derived
  from what the row *is* (UUIDv5, see `backend/cmd/seed/ids.go`), so a URL you
  hard-code today still works after a rebuild. Get the IDs by navigating the
  lists rather than guessing, then log them so the script is repeatable.
- **Dark mode is the default** (system preference). Force it with Playwright's
  `colorScheme: "dark"` / `"light"` on the context so shots are deterministic.
- Set `deviceScaleFactor: 2` for crisp captures; `optimize.mjs` downscales to
  1400px wide anyway.
- **Posting a goods receipt mutates data.** Capture #01 last, or re-seed after.
  The receipt endpoint is idempotent on a key, so a replay will not double-post.

### 2.5 Then optimize

`optimize.mjs` has a **hardcoded `PLAN` map** — new shots will be silently
skipped if you do not add them. Add every `erp-*` name with `1` (no crop) unless
a shot needs its fold trimmed. Two images that sit side by side in a grid must be
cropped to the *same* fraction, or they will not align.

```bash
node optimize.mjs && node build.mjs
```

`build.mjs` fails loudly on any unresolved `{{IMG:name}}` token, which is the
safety net for a typo.

---

## 3. Write the case study

The page is `src/page.html`; `index.html` is **generated** — never edit it by
hand. The structure is already multi-project:

- `#home` → the hero and a `#projects` carousel of `.project-card`s
- One `.project-view` per project, `id="project-<slug>"`, `data-project="<slug>"`
- A hash router at the bottom of the file that enumerates `.project-view` and
  routes `#project-<slug>`. **It needs no changes** — it already handles any
  number of projects.

### 3.1 Add the project card

In `#project-track`, **before** the `.ghost-card`:

```html
<a class="project-card" href="#project-mini-erp" data-project-link="mini-erp">
  <div class="thumb"><img src="{{IMG:erp-01-receipt-confirmation}}" alt="…" loading="lazy"></div>
  <div class="card-body">
    <p class="card-eyebrow">Backend · case study <span class="pill">Deploy-ready</span></p>
    <h3>mini-erp</h3>
    <p>A multi-tenant ERP where tenant isolation is enforced by the database, not by application code.</p>
    <div class="card-tags">
      <span class="pos">go</span><span class="pos">postgres</span><span class="pos">rls</span><span class="pos">react</span>
    </div>
    <span class="card-cta">View case study →</span>
  </div>
</a>
```

Check whether a `.pill` variant other than `.pill.live` exists; if not, add a
muted one rather than reusing `live`, which would claim something untrue.

**Update the count** — `<span class="count">1 project</span>` becomes
`2 projects`. It is hardcoded.

### 3.2 Add the case study view

Copy the *shape* of `#project-lw-sports`, not its prose. Its section rhythm is
good and worth keeping:

| Section | For mini-erp |
|---|---|
| `header` | What it is, in three sentences. Solo build |
| `context` | Why multi-tenant isolation is hard, and what usually goes wrong — one leaked query in one handler and every tenant sees every other tenant |
| `tour` | The screenshots, grouped by module |
| `scope` | What shipped and what did not. Be blunt: Finance is a **stub** — a chart of accounts and journal entries, no invoicing, no payment cycle, no period close. Single-level approvals. No audit log (designed, deliberately post-MVP) |
| `architecture` | The three tiers, and the RLS model. This is the section that has to be *right* — see §3.3 |
| `decisions` | Three or four, with what each cost. Candidates below |
| `problems` | One or two worth real space. Candidates below |
| `infra` | Go/Fiber, Postgres 17, React/TS/Vite/Tailwind, Firebase Auth, Neon, Docker, GitHub Actions |
| `status` | §1 of this file — deploy-ready, not deployed, and why |

Ownership is **not** a section here: this one is solo, unlike LW Sports. Say so
once in the header and drop the section.

### 3.3 The architecture section — the part that must be accurate

A reader who has never seen the code should be able to explain the isolation
model from this section alone. That is Phase 10's completion criterion.

The chain, in order:

1. A request arrives with a Firebase ID token. The token is verified for its
   **UID only** — never for claims.
2. Identity, roles and tenant are resolved **from the database on every
   request**. Authorization never comes from a token claim, because a claim is a
   snapshot that goes stale the moment an admin revokes access.
3. The handler runs inside a transaction that has issued
   `SET LOCAL app.current_tenant = <uuid>`. `SET LOCAL`, never plain `SET` — a
   session-scoped set would leak tenant context to the next request that reused
   the pooled connection.
4. Fourteen tables have RLS **enabled and forced**, with a policy comparing
   `tenant_id` to that setting. `FORCE` matters: without it the table owner
   bypasses the policy, which silently defeats the whole mechanism in local
   development where you are often connected as the owner.
5. Both database views are `security_invoker`. Without that flag a view runs
   with its *owner's* privileges and returns every tenant's rows to everybody.
6. No application role holds `BYPASSRLS` or `SUPERUSER`, and there is a checked-in
   verifier (`cmd/dbverify`) that asserts this against a live database — because
   a role created through a hosting provider's web console silently gets that
   privilege, and nothing looks wrong afterwards.

Worth stating plainly: **the frontend hiding a control is cosmetic.** Every
hidden control is independently enforced server-side. That is a design rule in
the project, not an aspiration.

### 3.4 Decisions worth writing up

Pick three or four. Each needs the cost, not just the choice.

- **Stock on hand is derived, never stored.** No counter column anywhere. Costs a
  view and some SQL; buys the impossibility of a counter drifting from the
  ledger that is supposed to explain it.
- **Nothing is ever deleted.** Master data soft-deletes, documents cancel,
  ledgers append. The one exception is a permission row, because revoking a
  grant has no history worth preserving — and that exception is written down.
- **Money is `NUMERIC(18,2)`, quantities `NUMERIC(18,4)`, never float.** The
  frontend carries an exact decimal type across the wire, and comparisons and
  sums are done in SQL rather than in Go, so nothing can round on the way.
- **Triggers state what is illegal; services state what happens next.** A trigger
  never inserts. Over-receipt and unbalanced journals are refused by the
  database; the decision about *what to do next* lives in a service.
- **Tests run against real PostgreSQL in a container**, never a mock or SQLite.
  RLS is a property of Postgres policy evaluation — a suite that stubs the
  database proves nothing about the one mechanism the project exists to show.

### 3.5 Problems worth real space

- **The cross-module transaction.** One goods receipt writes a receipt, stock
  ledger rows and a balanced journal entry in a single transaction, in a fixed
  order, with an idempotency key so a retried POST replays rather than
  double-posts. Screenshot #01 is the visible half. Mention the savepoint the
  idempotency check needs, and that the ordering is load-bearing enough to have
  its own test.
- **Segregation of duties.** You cannot approve your own requisition — including
  if you are the tenant admin. That last clause is where most implementations
  quietly make an exception, and this one does not.
- **Deleted rows must stay visible in history.** Lists filter soft-deleted rows
  and writes refuse them, but the ledger's product join reads them deliberately
  — adding `AND deleted_at IS NULL` by reflex would erase last quarter's history
  from the screen. There is a test that catches exactly that.

Do not invent numbers. Real ones available: 376 Go tests, 102 frontend tests, 6
migrations, 14 RLS-protected tables, 3 modules, 5 ranked role levels, 11
invariant checks passing against the production database.

---

## 4. The header nav — the one structural problem

`.nav-project` is a **single global nav** with hardcoded links:

```html
<a href="#tour">Product</a>
<a href="#scope">Scope</a>
<a href="#ownership">Ownership</a>
<a href="#architecture">Architecture</a>
<a class="live" href="https://sportclub-6d9de.firebaseapp.com/login">Live ↗</a>
```

Two things break with a second project:

1. **Duplicate section IDs.** If mini-erp also uses `id="scope"`,
   `getElementById` returns the *first* match in document order — the LW Sports
   one — so the nav scrolls to a hidden section. **Namespace mini-erp's section
   IDs**: `erp-context`, `erp-tour`, `erp-scope`, `erp-architecture`,
   `erp-decisions`, `erp-problems`, `erp-infra`, `erp-status`.
2. **The Live link is wrong for mini-erp** — it points at the sports app, and
   mini-erp has no live URL to offer anyway.

Simplest fix that stays in the spirit of the file: give each project its own nav
and let the router show one.

```html
<nav class="topbar-nav nav-project" data-nav-for="lw-sports"> … existing … </nav>
<nav class="topbar-nav nav-project" data-nav-for="mini-erp">
  <a href="#home">← All projects</a>
  <a href="#erp-tour">Product</a>
  <a href="#erp-scope">Scope</a>
  <a href="#erp-architecture">Architecture</a>
  <a class="live" href="https://github.com/Nimrod-DG/mini-erp" target="_blank" rel="noopener">Repo ↗</a>
</nav>
```

Then in `setActive(id)`, alongside the existing loop:

```js
document.querySelectorAll("[data-nav-for]").forEach(function (n) {
  n.setAttribute("data-active", n.getAttribute("data-nav-for") === id ? "true" : "false");
});
```

and a CSS rule hiding `.nav-project[data-active="false"]`. Check how the
existing `body[data-view]` rules show and hide `.nav-home` / `.nav-project`
before writing this — reuse that mechanism rather than inventing a second one.

The in-page click handler already ignores `#home`, `#projects` and `#project-*`
and smooth-scrolls everything else, so namespaced IDs work with no change to it.

---

## 5. Finish

```bash
node optimize.mjs && node build.mjs
```

Then check, in a browser, on the built `index.html`:

- [ ] `#home` shows **two** project cards and the count says "2 projects"
- [ ] `#project-mini-erp` deep-links directly, on a fresh load
- [ ] Browser **back** returns to home from either project
- [ ] Every nav link in the mini-erp nav scrolls to a mini-erp section — not to a
      LW Sports one. This is the duplicate-ID trap; test it deliberately
- [ ] The LW Sports case study is **unchanged** — same nav, same Live link
- [ ] Both light and dark render correctly
- [ ] 360px: no horizontal scroll on either case study
- [ ] `index.html` size is sane. It was ~1400 lines and inlines every image as
      base64; adding ~20 screenshots will grow it a lot. If it gets unwieldy,
      cut the shot list rather than the compression quality — 27 shots is an
      upper bound, and 12 good ones beat 27 filler ones

Commit both repos:

- **portfolio** — `src/page.html`, `capture-erp.mjs`, `optimize.mjs`, the new
  `shots/erp-*.jpg` and `shots/opt/erp-*.jpg`, and the rebuilt `index.html`
  (raw shots *are* tracked in this repo; check `git status` before assuming)
- **mini-erp** — append a Phase 10 entry to `docs/PROGRESS.md` recording that
  the write-up exists and where

---

## 6. Do not

- **Do not link the deployed frontend as "Live".** It stops at the login screen
  because it was built against a placeholder API URL. Link the repo.
- **Do not claim the app is deployed.** §1 has the honest wording.
- **Do not put credentials in the portfolio.** `password123` against a *local*
  demo is fine to mention; the Neon connection strings and the Firebase
  service-account key are not, and none of them belong in a public page.
- **Do not edit `index.html` directly.** It is generated from `src/page.html`.
- **Do not overclaim.** Finance is a stub, approvals are single-level, there is
  no audit log, and there is no period close. Saying so is worth more than
  hiding it — it leaves somewhere to go in an interview.
