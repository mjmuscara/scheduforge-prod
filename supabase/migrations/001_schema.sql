-- ============================================================
-- ScheduForge — Complete Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Organizations (one per company) ─────────────────────────
create table public.organizations (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  slug          text unique not null,          -- used in URLs
  plan          text not null default 'trial', -- trial | starter | growth | enterprise
  plan_expires_at timestamptz,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  max_employees int not null default 5,        -- plan limits
  created_at    timestamptz default now()
);

-- ── Profiles (extends Supabase auth.users) ───────────────────
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  org_id        uuid references public.organizations(id) on delete cascade,
  name          text not null,
  email         text not null,
  phone         text,
  role          text not null default 'employee', -- manager | employee
  position      text,                             -- e.g. "Cashier"
  department    text,                             -- e.g. "Front End"
  avatar_color  text default '#e8f0fc',
  avatar_text_color text default '#1a5fb4',
  is_active     boolean default true,
  created_at    timestamptz default now()
);

-- ── Invites (for employee onboarding) ───────────────────────
create table public.invites (
  id            uuid primary key default uuid_generate_v4(),
  org_id        uuid references public.organizations(id) on delete cascade,
  email         text not null,
  name          text not null,
  position      text,
  department    text,
  invited_by    uuid references public.profiles(id),
  token         text unique not null default encode(gen_random_bytes(32), 'hex'),
  accepted      boolean default false,
  expires_at    timestamptz default (now() + interval '7 days'),
  created_at    timestamptz default now()
);

-- ── Schedules ────────────────────────────────────────────────
create table public.schedules (
  id            uuid primary key default uuid_generate_v4(),
  org_id        uuid references public.organizations(id) on delete cascade,
  manager_id    uuid references public.profiles(id),
  week_start    date not null,  -- always a Monday
  published     boolean default false,
  published_at  timestamptz,
  created_at    timestamptz default now(),
  unique(org_id, week_start)
);

-- ── Shifts ───────────────────────────────────────────────────
create table public.shifts (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid references public.organizations(id) on delete cascade,
  schedule_id     uuid references public.schedules(id) on delete cascade,
  employee_id     uuid references public.profiles(id) on delete set null,
  shift_date      date not null,
  start_time      time not null,
  end_time        time not null,
  duration_hours  numeric(4,2) generated always as
                    (extract(epoch from (end_time - start_time)) / 3600) stored,
  position        text not null,
  department      text not null,
  notes           text,
  created_at      timestamptz default now()
);

-- ── Available Shifts (posted for coverage) ───────────────────
create table public.available_shifts (
  id            uuid primary key default uuid_generate_v4(),
  org_id        uuid references public.organizations(id) on delete cascade,
  shift_id      uuid references public.shifts(id) on delete cascade,
  posted_by     uuid references public.profiles(id),
  reason        text,
  is_open       boolean default true,
  created_at    timestamptz default now()
);

-- ── Shift Requests ───────────────────────────────────────────
create table public.shift_requests (
  id                uuid primary key default uuid_generate_v4(),
  org_id            uuid references public.organizations(id) on delete cascade,
  available_shift_id uuid references public.available_shifts(id) on delete cascade,
  requester_id      uuid references public.profiles(id),
  status            text not null default 'pending', -- pending | approved | denied | expired
  reviewed_by       uuid references public.profiles(id),
  reviewed_at       timestamptz,
  created_at        timestamptz default now()
);

-- ── Notifications ────────────────────────────────────────────
create table public.notifications (
  id            uuid primary key default uuid_generate_v4(),
  org_id        uuid references public.organizations(id) on delete cascade,
  user_id       uuid references public.profiles(id) on delete cascade,
  text          text not null,
  read          boolean default false,
  created_at    timestamptz default now()
);

-- ============================================================
-- Row Level Security — each org only sees its own data
-- ============================================================

alter table public.organizations    enable row level security;
alter table public.profiles         enable row level security;
alter table public.invites          enable row level security;
alter table public.schedules        enable row level security;
alter table public.shifts           enable row level security;
alter table public.available_shifts enable row level security;
alter table public.shift_requests   enable row level security;
alter table public.notifications    enable row level security;

-- ── Signup: create org + manager profile atomically ─────────────────────────
-- SECURITY DEFINER so it runs as the function owner, bypassing RLS.
-- Called during manager signup before the user has a profile (my_org_id() = null).
create or replace function public.create_organization_and_profile(
  org_name      text,
  org_slug      text,
  manager_name  text,
  manager_email text,
  user_id       uuid
)
returns void language plpgsql security definer set search_path = public as $$
declare
  new_org_id uuid;
  palette    text[][] := array[
    array['#e8f0fc','#1a5fb4'],
    array['#fef3e2','#a35c0a'],
    array['#fdecea','#c0392b'],
    array['#f0eeff','#5c3ab4']
  ];
  pair text[];
begin
  insert into public.organizations (name, slug, plan, max_employees)
  values (org_name, org_slug, 'trial', 5)
  returning id into new_org_id;

  pair := palette[1 + (floor(random() * 4))::int];

  insert into public.profiles (id, org_id, name, email, role, avatar_color, avatar_text_color)
  values (user_id, new_org_id, manager_name, manager_email, 'manager', pair[1], pair[2]);
end;
$$;

-- Helper: get current user's org_id
create or replace function public.my_org_id()
returns uuid language sql stable security definer as $$
  select org_id from public.profiles where id = auth.uid()
$$;

-- Helper: is current user a manager?
create or replace function public.is_manager()
returns boolean language sql stable security definer as $$
  select role = 'manager' from public.profiles where id = auth.uid()
$$;

-- Organizations: members can read their own org
create policy "org_select" on public.organizations for select
  using (id = public.my_org_id());

-- Profiles: everyone in the org can see each other
create policy "profiles_select" on public.profiles for select
  using (org_id = public.my_org_id());
create policy "profiles_insert" on public.profiles for insert
  with check (id = auth.uid()); -- org creation uses SECURITY DEFINER and bypasses this
create policy "profiles_update_own" on public.profiles for update
  using (id = auth.uid());
create policy "profiles_update_manager" on public.profiles for update
  using (public.is_manager() and org_id = public.my_org_id());
create policy "profiles_delete_manager" on public.profiles for delete
  using (public.is_manager() and org_id = public.my_org_id() and id <> auth.uid());

-- Invites: managers can manage
-- Authenticated org members see their own org's invites
create policy "invites_select_member" on public.invites for select
  to authenticated
  using (org_id = public.my_org_id());
-- Anon users can read any invite by token (required for pre-auth acceptance;
-- token is 64-char random hex so enumeration is infeasible)
create policy "invites_select_token" on public.invites for select
  to anon
  using (true);
create policy "invites_insert" on public.invites for insert
  with check (public.is_manager() and org_id = public.my_org_id());
-- Profile exists by the time acceptInvite marks accepted, so my_org_id() resolves
create policy "invites_update" on public.invites for update
  using (org_id = public.my_org_id());

-- Schedules
create policy "schedules_select" on public.schedules for select
  using (org_id = public.my_org_id());
create policy "schedules_insert" on public.schedules for insert
  with check (public.is_manager() and org_id = public.my_org_id());
create policy "schedules_update" on public.schedules for update
  using (public.is_manager() and org_id = public.my_org_id());

-- Shifts
create policy "shifts_select" on public.shifts for select
  using (org_id = public.my_org_id());
create policy "shifts_insert" on public.shifts for insert
  with check (public.is_manager() and org_id = public.my_org_id());
create policy "shifts_update" on public.shifts for update
  using (public.is_manager() and org_id = public.my_org_id());
create policy "shifts_delete" on public.shifts for delete
  using (public.is_manager() and org_id = public.my_org_id());

-- Available shifts
create policy "avail_select" on public.available_shifts for select
  using (org_id = public.my_org_id());
create policy "avail_insert" on public.available_shifts for insert
  with check (org_id = public.my_org_id());
create policy "avail_update" on public.available_shifts for update
  using (org_id = public.my_org_id());

-- Shift requests
create policy "requests_select" on public.shift_requests for select
  using (org_id = public.my_org_id());
create policy "requests_insert" on public.shift_requests for insert
  with check (org_id = public.my_org_id());
create policy "requests_update" on public.shift_requests for update
  using (org_id = public.my_org_id());

-- Notifications
create policy "notif_select" on public.notifications for select
  using (user_id = auth.uid());
create policy "notif_update" on public.notifications for update
  using (user_id = auth.uid());
create policy "notif_insert" on public.notifications for insert
  with check (org_id = public.my_org_id());

-- ============================================================
-- Database Function: expire stale requests
-- Called by a pg_cron job every 5 minutes
-- ============================================================
create or replace function public.expire_stale_shift_requests()
returns void language plpgsql security definer as $$
declare
  req record;
  shift record;
  avail record;
begin
  for req in
    select sr.*, as2.shift_id, as2.org_id as avail_org_id
    from public.shift_requests sr
    join public.available_shifts as2 on as2.id = sr.available_shift_id
    where sr.status = 'pending'
  loop
    select * into shift from public.shifts where id = req.shift_id;
    if shift is not null then
      -- Check if shift start datetime is in the past
      if (shift.shift_date + shift.start_time)::timestamptz < now() then
        -- Expire the request
        update public.shift_requests set status = 'expired' where id = req.id;
        -- Close the available shift
        update public.available_shifts set is_open = false where id = req.available_shift_id;
        -- Notify requester
        insert into public.notifications(org_id, user_id, text)
        values (
          req.org_id,
          req.requester_id,
          'Your shift request for ' || shift.position || ' on ' || shift.shift_date::text || ' has expired because the shift already started.'
        );
        -- Notify manager
        insert into public.notifications(org_id, user_id, text)
        select req.org_id, p.id,
          'Shift request from ' || (select name from public.profiles where id = req.requester_id) ||
          ' for ' || shift.position || ' on ' || shift.shift_date::text || ' expired (shift already started).'
        from public.profiles p
        where p.org_id = req.org_id and p.role = 'manager';
      end if;
    end if;
  end loop;
end;
$$;

-- ============================================================
-- Enable Realtime on tables that need live updates
-- ============================================================
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.shift_requests;
alter publication supabase_realtime add table public.available_shifts;
-- organizations: lets the client detect plan changes pushed by the Stripe webhook
alter publication supabase_realtime add table public.organizations;
