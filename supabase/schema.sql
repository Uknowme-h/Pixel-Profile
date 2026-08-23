-- Phase 2 — Data model (Supabase Postgres). Run in Supabase SQL Editor.

-- profile_configs: one row per user's card configuration.
create table if not exists public.profile_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  username text not null,
  template_id text not null check (template_id in ('pixel', 'arcade', 'fastfetch', 'canvas')),
  theme jsonb not null default '{"bg":"#1a1b26","fg":"#c0caf5","accent":"#7aa2f7","muted":"#565f89"}',
  fields jsonb not null default '{}',
  mascot_svg_url text,
  config_hash text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists profile_configs_user_id_idx on public.profile_configs (user_id);

-- github_data_cache: derived profile fields ONLY (never raw GraphQL JSON).
-- Lean rows keep the free tier's ~500MB well under budget.
create table if not exists public.github_data_cache (
  username text primary key,
  login text not null,
  name text,
  bio text,
  avatar_url text,
  total_contributions integer not null default 0,
  commits integer not null default 0,
  pull_requests integer not null default 0,
  issues integer not null default 0,
  repos_contributed integer not null default 0,
  languages jsonb not null default '{}',
  pinned_repos jsonb not null default '[]',
  starred_repos integer not null default 0,
  fetched_at timestamptz not null default now(),
  etag_key text,
  last_status text not null default 'ok' check (last_status in ('ok', 'not_found', 'error')),
  failure_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists github_data_cache_fetched_at_idx on public.github_data_cache (fetched_at);

-- render_jobs: refresh scheduling state (stalest-first batches).
create table if not exists public.render_jobs (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed')),
  last_run timestamptz,
  next_scheduled timestamptz not null default now(),
  failure_count integer not null default 0,
  updated_at timestamptz not null default now()
);

-- RLS: users manage their own configs; the service role (refresh + render)
-- bypasses RLS. Public reads of github_data_cache/render_jobs are NOT needed.
alter table public.profile_configs enable row level security;
alter table public.github_data_cache enable row level security;
alter table public.render_jobs enable row level security;

create policy "users read own configs" on public.profile_configs
  for select using (auth.uid() = user_id);
create policy "users insert own configs" on public.profile_configs
  for insert with check (auth.uid() = user_id);
create policy "users update own configs" on public.profile_configs
  for update using (auth.uid() = user_id);
create policy "users delete own configs" on public.profile_configs
  for delete using (auth.uid() = user_id);

-- No policies on github_data_cache / render_jobs: the service-role client
-- (server + Actions workflow) reads/writes these. Keep them locked down.

-- ── Migration: add per-type contribution columns (run once in SQL Editor) ────
-- Safe to run on an existing database — columns are added with DEFAULT 0 so
-- existing rows immediately have valid values. A data refresh will overwrite
-- them with real values pulled from the GitHub API.
alter table public.github_data_cache
  add column if not exists commits          integer not null default 0,
  add column if not exists pull_requests    integer not null default 0,
  add column if not exists issues           integer not null default 0,
  add column if not exists repos_contributed integer not null default 0;

-- ── Migration: allow canvas editor template ──────────────────────────────────
alter table public.profile_configs drop constraint if exists profile_configs_template_id_check;
alter table public.profile_configs
  add constraint profile_configs_template_id_check
  check (template_id in ('pixel', 'arcade', 'fastfetch', 'canvas'));

