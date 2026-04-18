-- Tabela de posts marcados como concorrentes pelo usuário
create table if not exists public.market_research_competitors (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  tenant_id     text        not null,
  post_id       text        not null,
  platform      text        not null,
  post_url      text        not null,
  post_type     text        not null default 'image',
  thumbnail_url text        not null default '',
  media_url     text,
  video_url     text,
  caption       text        default '',
  published_at  timestamptz,
  metrics       jsonb       not null default '{}',
  hashtags      text[]      not null default '{}',
  mentions      text[]      not null default '{}',
  created_at    timestamptz not null default now(),
  unique(user_id, tenant_id, post_id)
);

alter table public.market_research_competitors enable row level security;

create policy "Users can read own competitors"
  on public.market_research_competitors for select
  using (auth.uid() = user_id);

create policy "Users can insert own competitors"
  on public.market_research_competitors for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own competitors"
  on public.market_research_competitors for delete
  using (auth.uid() = user_id);

create index if not exists idx_competitors_user_tenant
  on public.market_research_competitors (user_id, tenant_id);
