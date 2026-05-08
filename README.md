# ScheduForge — Production App

Full-stack shift scheduling SaaS with real accounts, multi-tenancy, payments, and invite-based onboarding.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + React Router v6 |
| Auth + Database | Supabase (Postgres + Auth) |
| Payments | Stripe Billing |
| Hosting | Netlify (frontend) |
| Edge functions | Supabase Edge Functions (Deno) |

---

## Setup Guide (Step by Step)

### Step 1 — Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Name it `scheduforge`, choose a region close to you, set a database password
3. Wait ~2 minutes for it to provision
4. Go to **Settings → API** and copy:
   - **Project URL** → `REACT_APP_SUPABASE_URL`
   - **anon public** key → `REACT_APP_SUPABASE_ANON_KEY`

### Step 2 — Run the database migration

1. In Supabase: go to **SQL Editor → New query**
2. Paste the entire contents of `supabase/migrations/001_schema.sql`
3. Click **Run** — this creates all tables, RLS policies, and functions

### Step 3 — Configure Supabase Auth

1. Go to **Authentication → URL Configuration**
2. Set **Site URL** to `https://app.yourdomain.com` (or your Netlify URL)
3. Add to **Redirect URLs**: `https://app.yourdomain.com/**`
4. Go to **Authentication → Email Templates** — customize the invite/reset emails with your branding

### Step 4 — Create a Stripe account

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com)
2. Create 3 products with monthly recurring prices:
   - **Starter** → $29/month → copy the `price_id`
   - **Growth** → $79/month → copy the `price_id`
   - **Enterprise** → custom → copy the `price_id`
3. Go to **Developers → API keys** → copy the **Publishable key**

### Step 5 — Set up environment variables

Copy `.env.example` to `.env.local` and fill in all values:

```bash
cp .env.example .env.local
```

```env
REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
REACT_APP_STRIPE_STARTER_PRICE_ID=price_xxx
REACT_APP_STRIPE_GROWTH_PRICE_ID=price_xxx
REACT_APP_STRIPE_ENTERPRISE_PRICE_ID=price_xxx
REACT_APP_URL=https://app.yourdomain.com
```

### Step 6 — Deploy Supabase Edge Functions

Install the Supabase CLI:
```bash
npm install -g supabase
supabase login
supabase link --project-ref your-project-id
```

Set secrets (server-side, never exposed to client):
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
supabase secrets set STRIPE_STARTER_PRICE_ID=price_xxx
supabase secrets set STRIPE_GROWTH_PRICE_ID=price_xxx
supabase secrets set STRIPE_ENTERPRISE_PRICE_ID=price_xxx
```

Deploy functions:
```bash
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
supabase functions deploy customer-portal
```

### Step 7 — Set up Stripe webhook

1. In Stripe: **Developers → Webhooks → Add endpoint**
2. URL: `https://your-project-id.supabase.co/functions/v1/stripe-webhook`
3. Events to listen for:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the **Signing secret** → set as `STRIPE_WEBHOOK_SECRET` in step 6

### Step 8 — Deploy to Netlify

```bash
npm install
npm run build
```

Then either:
- Drag the `/build` folder to [app.netlify.com/drop](https://app.netlify.com/drop)
- Or connect your GitHub repo in Netlify for automatic deploys

**Important:** In Netlify → Site settings → Environment variables, add all your `REACT_APP_*` variables.

Also add a `netlify.toml` redirect (already included):
```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Step 9 — Enable scheduled request expiration (optional)

In Supabase SQL editor, enable pg_cron to auto-expire stale shift requests:
```sql
-- Enable pg_cron extension
create extension if not exists pg_cron;

-- Run every 5 minutes
select cron.schedule('expire-shift-requests', '*/5 * * * *', 'select public.expire_stale_shift_requests()');
```

---

## How Accounts Work

### Manager signs up
1. Goes to `yourdomain.com/signup`
2. Enters company name, their name, email, password
3. Account created → 14-day trial starts → lands on dashboard
4. Upgrades via **Billing** tab when ready

### Employee joins
1. Manager goes to **Employees → Invite employee**
2. Enters employee name, email, position, department
3. App generates a unique invite link (e.g. `yourdomain.com/invite?token=abc123`)
4. Manager shares link via email, Slack, text, etc.
5. Employee clicks link → enters their name + creates password → account created
6. Employee can now log in at `yourdomain.com/login`

### Password reset
- User goes to login page → clicks "Forgot password?"
- Enters email → receives reset link from Supabase
- Clicks link → sets new password → signed in

---

## Data isolation (multi-tenancy)

Every piece of data in the database has an `org_id` column. Supabase Row Level Security (RLS) policies ensure that:
- Employees can only see data from their own organization
- Managers can only manage data within their own organization
- No organization can ever access another organization's data

This is enforced at the **database level**, not just in the app code.

---

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your values
npm start                     # http://localhost:3000
```

---

## Pricing tiers

| Plan | Price | Max Employees |
|---|---|---|
| Trial | Free (14 days) | 5 |
| Starter | $29/month | 15 |
| Growth | $79/month | 75 |
| Enterprise | Custom | Unlimited |

Stripe handles all billing, invoicing, failed payment retries, and cancellations automatically.
