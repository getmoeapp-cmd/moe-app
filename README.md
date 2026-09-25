# MOE — Make Ordering Easy

MOE is a kitchen inventory and supplier-ordering app for restaurants. Count what is on hand, see what is low, and place an order with the supplier who sells it.

The default app at `/app` is that path only. Waste, the price tracker, invoice import, recipes, role permissions, and subscription screens stay in the classic app, behind a closed More menu.

## Run

```bash
npm install
npm start
```

Open [http://localhost:3000/app](http://localhost:3000/app). The marketing site stays at `/`. The savings quiz stays at `/quiz`.

```bash
npm run build
```

Create React App builds the client. `vercel.json` rewrites non-API routes to `index.html` and keeps `api/claude.js` as a serverless function.

## Routes

| URL | What opens |
| --- | --- |
| `/` | Marketing site |
| `/quiz` | Savings estimate. The trial button opens account creation. |
| `/app` | Sign in |
| `/app?signup=1` | Create a restaurant account |
| `/app?classic=1` or `/classic` | Previous full app |
| `/privacy`, `/terms`, `/contact` | Plain-language pages. No placeholder links. |

Sign-in does not display a demo password. Create an account from the quiz or from Create an account. The classic menu keeps Place Order, Orders, Order History, Edit items, and Settings in front. Waste, insights, recipes, the price tracker, invoice import, subscription, and admin sit under More. Role permissions are a text link inside Settings, after Vendors and Team.

The quiz reports one monthly total. The four lines are monthly and add up to it. The year figure is that monthly total times 12. Payback uses the same monthly number against the $399 plan.

## Accounts and security

- Sign-in is Supabase Auth (hashed passwords, reset by email). One login session is shared by `/app` and `/app?classic=1`.
- Each restaurant is a row in `moe_kitchens`; people belong to it through `moe_members` (owner / manager / employee).
- Owners and managers add staff with an invite code (Settings → Team). The employee opens `/app?join=CODE` and picks their own password.
- Row-level security on `moe_data` only lets members of a kitchen read or write that kitchen's rows. `subscription` can only be written by the server or a platform admin.
- Platform admins (`moe_platform_admins`) see every restaurant under Classic → More → Admin and can activate a plan after payment, extend a trial, or cancel.
- `/api/claude` (invoice/photo import) only answers signed-in kitchen members.
- Stock counts, count log, order history, and usage are written with atomic server functions (`moe_merge`, `moe_prepend`, `moe_merge_usage`) so two phones never overwrite each other.

Database changes live in `supabase/migrations/` (010 tables + functions, 020 moves old logins into Supabase Auth, 030 locks the table down — run 030 only after the new build is live).

## Item setup (product list) and costing

Settings → Items is the product list, with the same columns as a kitchen costing sheet:
Usage Section · Item Description · Vendor · Vendor Item # · Purchase Price · # Per Case · Size (lb / oz / gal / qt / L / each / pack of N / bottle of N oz) · → cost per unit · cost per oz or piece.
Plus how the item is **counted** (single units, or whole cases with halves) and its **order rule**: "reorder when below X (in the count unit) → order Y cases". If Y cases still wouldn't get back above X, MOE orders enough cases to. Items set up before this keep the old fill-to-par behavior until edited.

- Stock is always stored in single units; "count by case" just converts (2.5 cases × 6 gal = 15 gal).
- Vendor item # and the pack size ("Case (6 gallons)") print on the order PDF.
- **Import from costing sheet**: Google Sheets → File → Download → CSV of the product list tab. Rows match existing items by name.
- Costs tab: Item costs (price per oz / piece), Recipes (prep batches → cost per serving and per oz; menu items → plate cost, food cost %), Usage.
- Engine: `src/lib/costing.js` (tests in `costing.test.js`).

### Counting vs. what the vendor ships

Per item: **Count it by** (single pieces, or cases) · **Vendor sells it as** (full case only, or case + singles) · the rule.
- Full case only: "below X → order Y cases".
- Split case: "below X → bring back up to Y" — MOE orders whole cases first, singles for the rest. Optional single-piece price.
- Optional piece name (loaf, bottle, wheel) so every screen and the PDF use the right word.
- The review screen shows **"Rep sees: 2 CASES — 6 loaves each · 12 loaves total"** on every line, and the PDF prints the same
  ORDER column plus a "how to read this order" legend, so pieces can never be entered as cases.

## Order day flow

1. **Count** tab: on each supplier's order day (Settings → Suppliers → order days) a fresh count sheet opens. Every item starts at 0; staff enter what's on the shelf. Counts also update Stock and the count log.
2. Tap **Done — send to review**, or leave it: any sheet still open after its day is closed automatically the next time anyone opens MOE. Items nobody counted are treated as 0 and flagged "not counted".
3. **Orders** tab (owner/manager): the draft shows on hand, par, and the quantity needed to get back to par. Edit quantities (managers can't go over par), add a note, save, or approve.
4. **Approve & make PDF** saves the order and creates a purchase-order PDF. On a phone it opens the share sheet (text, WhatsApp, email); on a computer it downloads. Email/Text rep buttons use the rep contact saved on the supplier.
5. **Mark received** when it arrives (or check in line by line in the full app).

Storage: `sheet_<date>_<vendorId>` (per-item merge), `drafts` (array; `moe_array_*` functions in migration 040).

## Pars and usage

- The owner sets a **par** (how many to have on hand after a delivery) and a **reorder point** per item (Settings → Items).
- Ordering fills each item back up to par. Managers can't order past par — only the owner can, and it's flagged on the order.
- Every count and order is logged. For each item, MOE computes `used = on hand at last count + delivered since − on hand now`.
- After 3 count-to-count gaps (about 3 weeks), the **Usage** tab shows weekly use and recommends a new par
  (use between deliveries × 1.25) when the current par is 15%+ off. The owner taps once to apply.
- Engine: `src/lib/usage.js` (tests in `usage.test.js`). Auto-submitted orders are ignored as deliveries; short/out-of-stock check-ins count only what arrived.

## Environment

| Name | Where | Purpose |
| --- | --- | --- |
| `REACT_APP_SUPABASE_URL` | Build (optional) | Supabase project URL |
| `REACT_APP_SUPABASE_ANON_KEY` | Build (optional) | Public anon key used by the browser |
| `REACT_APP_SUPPORT_EMAIL` | Build (optional) | Where "subscribe" and "contact" go. Default hello@getmoe.ai |
| `ANTHROPIC_API_KEY` | Server | Invoice and photo import |
| `ANTHROPIC_MODEL` | Server (optional) | Default `claude-sonnet-4-5` |
