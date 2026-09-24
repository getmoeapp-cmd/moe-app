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

## Environment

| Name | Where | Purpose |
| --- | --- | --- |
| `REACT_APP_SUPABASE_URL` | Build | Supabase project URL |
| `REACT_APP_SUPABASE_ANON_KEY` | Build | Public anon key used by the browser |
| `ANTHROPIC_API_KEY` | Server (`api/claude.js`) | Classic invoice and import tools only |

If the `REACT_APP_` values are missing at build time, the client falls back to the Supabase URL and anon key already shipped in the classic bundle so the current Vercel project keeps working. Set the variables and rebuild to move off that fallback. Do not commit `.env`. See `.env.example`.

## Data the app already expects

There is one table, `public.moe_data`:

| Column | Role |
| --- | --- |
| `group_id` | Restaurant id, or a global bucket such as `__moe_accounts__` |
| `data_key` | Blob name (`inventory`, `stock`, `vendors`, `history`, …) |
| `data_value` | JSON stored as text |

Upserts use `onConflict: "group_id,data_key"`, so those two columns need a unique constraint or primary key. The browser uses the anon key, so the anon role must be allowed to select and upsert. Realtime on `moe_data` is optional; classic MOE subscribes to it, and the simple app does too when it is enabled.

Kitchen blobs for a restaurant group:

- `inventory` — sections and items (`name`, `vendor`, `reorder`, `max_stock`, `order_unit`, `upu`)
- `stock` — `{ [itemId]: onHand }`
- `vendors` — `{ id, name, orderDays }` where days are `0` Sunday through `6` Saturday
- `history` — supplier orders
- `usageLog` — weekly quantities, kept so classic insights still see new orders
- `countLog` — recent counts
- `subscription` — `{ plan, status, trialStart, trialEnd }`

Accounts live at group `__moe_accounts__`, key `accounts`. Team members live on the restaurant's `team` blob. Passwords are stored in those JSON blobs. That is how sign-in already works; this redesign does not move accounts to Supabase Auth, because doing so would lock out existing restaurants.

New restaurants with nothing saved start from an empty item list. The demo group falls back to the built-in starter kitchen. Items that have never been counted are not treated as zero and are not suggested on an order until someone counts them.

Choosing a plan after a trial writes `subscription.status = "active"`. It does not charge a card. There is no payment provider in this repo.

## Layout

```
src/App.jsx                 route switch
src/simple/                 default kitchen UI
src/lib/                    Supabase, stock math, orders, auth, quiz math
src/lib/defaults.js         starter list shared with classic
src/pages/LegalPage.jsx     privacy, terms, contact
src/kitchen_inventory_app.jsx
api/claude.js               classic Anthropic proxy
```

Classic features still in `kitchen_inventory_app.jsx`: dashboard, day-based place-order, quick orders, delivery check-in, order history, par insights, waste log, recipes and food cost, price tracker, AI import, item backend, team and permissions, onboarding, subscription pages, platform admin, and the sales-rep dashboard.
