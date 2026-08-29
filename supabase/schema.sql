-- ============================================
-- Word notebook - database schema and security policies
-- Run this file in the Supabase SQL Editor
-- ============================================

-- Enable required extensions
create extension if not exists "pgcrypto";

-- ============================================
-- Table: words
-- ============================================
create table if not exists public.words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  word text not null,
  meaning text not null,
  example text,
  note text,
  status text not null default 'new' check (status in ('new', 'learning', 'mastered')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger function for automatically updating updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger words_set_updated_at
  before update on public.words
  for each row
  execute function public.set_updated_at();

-- Indexes to speed up queries by user and status
create index if not exists words_user_id_idx on public.words (user_id);
create index if not exists words_user_status_idx on public.words (user_id, status);
create index if not exists words_user_created_idx on public.words (user_id, created_at desc);

-- ============================================
-- Row-level security (RLS) policies
-- Each user can access only their own words
-- ============================================
alter table public.words enable row level security;

-- Remove old policies to allow rerunning this script
drop policy if exists "Users can view own words" on public.words;
drop policy if exists "Users can insert own words" on public.words;
drop policy if exists "Users can update own words" on public.words;
drop policy if exists "Users can delete own words" on public.words;

-- Read: own words only
create policy "Users can view own words"
  on public.words for select
  using (auth.uid() = user_id);

-- Insert: own words only
create policy "Users can insert own words"
  on public.words for insert
  with check (auth.uid() = user_id);

-- Update: own words only
create policy "Users can update own words"
  on public.words for update
  using (auth.uid() = user_id);

-- Delete: own words only
create policy "Users can delete own words"
  on public.words for delete
  using (auth.uid() = user_id);
