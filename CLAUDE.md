# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install       # install dependencies
npm start         # dev server at http://localhost:3000
npm run build     # production build → build/
npm test          # run tests
```

### Deploy Edge Functions

```bash
supabase login
supabase link --project-ref your-project-id
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
supabase functions deploy customer-portal
```

Stripe secrets go into Supabase (never `.env.local`):

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
supabase secrets set STRIPE_STARTER_PRICE_ID=price_xxx
supabase secrets set STRIPE_GROWTH_PRICE_ID=price_xxx
supabase secrets set STRIPE_ENTERPRISE_PRICE_ID=price_xxx
supabase secrets set APP_ORIGIN=https://yourapp.netlify.app   # restricts CORS to your domain
```

## Architecture

### Auth and session state

`src/context/AuthContext.js` is the single source of truth for auth. It exposes three objects consumed throughout the app:

- `session` — Supabase JWT session
- `profile` — the current user's row from `public.profiles` (includes `role`, `position`, `department`, `org_id`)
- `org` — the current user's row from `public.organizations` (includes `plan`, `max_employees`)

All auth flows live here: `signUp`, `signIn`, `signOut`, `acceptInvite`, `sendPasswordReset`, `updatePassword`.

### Data hooks

`src/hooks/useData.js` contains one hook per entity. Each calls Supabase directly — there is no intermediate API layer. RLS policies on the database enforce org-scoping automatically, so hooks never manually filter by `org_id` except when inserting.

Key hooks: `useEmployees`, `useShifts(weekStart, weekEnd)`, `useMyShifts(weekStart, weekEnd)`, `useAvailableShifts`, `useShiftRequests`, `useMyRequests`, `useSchedule(weekStartISO)`, `useInvites`, `useNotifications`.

`useNotifications` is the only hook that subscribes to Supabase Realtime — it pushes new notification rows to state live without polling.

### Routing and role separation

`src/App.js` defines all routes. `AppLayout` wraps protected routes and redirects unauthenticated users to `/login`. Employee routes are under `/dashboard`, `/schedule`, `/available`, `/requests`, `/notifications`. Manager routes are under `/manager/*`. Role mismatch redirects to the correct root for that role.

### Database and multi-tenancy

Schema and all RLS policies are in `supabase/migrations/001_schema.sql`. Every table has an `org_id` column. RLS helper functions `my_org_id()` and `is_manager()` (both `SECURITY DEFINER`) are used across all policies.

`create_organization_and_profile` is a `SECURITY DEFINER` RPC called during manager signup — it creates the org and manager profile atomically and bypasses RLS (the new user has no profile yet when it runs).

Employee removal is a soft delete: `profiles.is_active = false`. Historical shift records are preserved.

Schedules are per-week, with a unique constraint on `(org_id, week_start)`. `ensureSchedule` in `useSchedule` creates the row on first shift add if it doesn't exist yet.

### Stripe and billing

All Stripe secret keys live only in Supabase Edge Functions (Deno). The three functions are:
- `supabase/functions/create-checkout-session/` — creates a Stripe Checkout session
- `supabase/functions/stripe-webhook/` — listens for subscription events and updates `organizations.plan` + `organizations.max_employees`
- `supabase/functions/customer-portal/` — opens the Stripe billing portal for an org

The webhook verifies the Stripe signature via `stripe.webhooks.constructEvent` before processing.

`create-checkout-session` and `customer-portal` require a valid Supabase JWT in the `Authorization: Bearer <token>` header and verify that the `orgId` in the request body matches the caller's own org. Only managers can call these endpoints. When wiring up the Billing page, fetch the session token via `supabase.auth.getSession()` and pass `session.access_token` as the Bearer token.

### Shared UI

`src/components/UI.js` contains all shared components: `Btn`, `Card`, `Badge`, `Avatar`, `StatCard`, `Modal`, `FormRow`, `Input`, `Select`, `EmptyState`, `PageHeader`, `Toast`, `Spinner`, `LoadingScreen`. Use these instead of raw HTML elements for consistency.

Date utilities (`fmtDate`, `fmtTime`, `getWeekStart`, `addDays`, `toISO`, `buildWeek`, `fmtWeekRange`, `colorFor`) are in `src/utils/dates.js`.

## Environment variables

All client-side vars use the `REACT_APP_` prefix (Create React App requirement):

```env
REACT_APP_SUPABASE_URL=
REACT_APP_SUPABASE_ANON_KEY=
REACT_APP_STRIPE_PUBLISHABLE_KEY=
REACT_APP_STRIPE_STARTER_PRICE_ID=
REACT_APP_STRIPE_GROWTH_PRICE_ID=
REACT_APP_STRIPE_ENTERPRISE_PRICE_ID=
REACT_APP_URL=
```

Copy `.env.example` → `.env.local`. The Supabase URL and anon key come from Supabase Dashboard → Settings → API.
