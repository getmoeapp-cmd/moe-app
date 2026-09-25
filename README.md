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

## Environment

| Name | Where | Purpose |
| --- | --- | --- |
| `REACT_APP_SUPABASE_URL` | Build (optional) | Supabase project URL |
| `REACT_APP_SUPABASE_ANON_KEY` | Build (optional) | Public anon key used by the browser |
| `REACT_APP_SUPPORT_EMAIL` | Build (optional) | Where "subscribe" and "contact" go. Default hello@getmoe.ai |
| `ANTHROPIC_API_KEY` | Server | Invoice and photo import |
| `ANTHROPIC_MODEL` | Server (optional) | Default `claude-sonnet-4-5` |
