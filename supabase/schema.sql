-- ============================================
-- 单词记录工具 - 数据库 Schema 与安全策略
-- 在 Supabase SQL Editor 中运行此文件
-- ============================================

-- 启用必要的扩展
create extension if not exists "pgcrypto";

-- ============================================
-- 表：words（单词记录）
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

-- 自动更新 updated_at 的触发器函数
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

-- 索引：加速按用户和状态查询
create index if not exists words_user_id_idx on public.words (user_id);
create index if not exists words_user_status_idx on public.words (user_id, status);
create index if not exists words_user_created_idx on public.words (user_id, created_at desc);

-- ============================================
-- 行级安全（RLS）策略
-- 每个用户只能访问自己的单词
-- ============================================
alter table public.words enable row level security;

-- 删除旧的策略（避免重复运行时报错）
drop policy if exists "Users can view own words" on public.words;
drop policy if exists "Users can insert own words" on public.words;
drop policy if exists "Users can update own words" on public.words;
drop policy if exists "Users can delete own words" on public.words;

-- 查看：只能看自己的
create policy "Users can view own words"
  on public.words for select
  using (auth.uid() = user_id);

-- 新增：只能添加自己的
create policy "Users can insert own words"
  on public.words for insert
  with check (auth.uid() = user_id);

-- 更新：只能改自己的
create policy "Users can update own words"
  on public.words for update
  using (auth.uid() = user_id);

-- 删除：只能删自己的
create policy "Users can delete own words"
  on public.words for delete
  using (auth.uid() = user_id);
