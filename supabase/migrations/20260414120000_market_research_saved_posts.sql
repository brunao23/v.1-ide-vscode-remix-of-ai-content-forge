-- Saved posts from market research (bookmarks)
create table if not exists public.market_research_saved_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id text not null,
  post_id text not null,
  platform text not null,
  post_url text not null,
  post_type text not null default 'image',
  thumbnail_url text,
  media_url text,
  caption text,
  published_at timestamptz,
  metrics jsonb not null default '{}'::jsonb,
  hashtags text[] not null default '{}',
  mentions text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Unique constraint: one save per post per user per tenant
alter table public.market_research_saved_posts
  add constraint market_research_saved_posts_unique
  unique (user_id, tenant_id, post_id);

-- Index for fast listing
create index if not exists idx_mr_saved_posts_user_tenant
  on public.market_research_saved_posts (user_id, tenant_id, created_at desc);

-- RLS
alter table public.market_research_saved_posts enable row level security;

create policy "Users can view own saved posts"
  on public.market_research_saved_posts for select
  using (auth.uid() = user_id);

create policy "Users can insert own saved posts"
  on public.market_research_saved_posts for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own saved posts"
  on public.market_research_saved_posts for delete
  using (auth.uid() = user_id);
