-- Tabela de análises Gemini AI para posts favoritos
create table if not exists public.market_research_gemini_analyses (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  tenant_id     text        not null,
  post_id       text        not null,
  post_url      text        not null,
  platform      text        not null,
  status        text        not null default 'pending'
                  check (status in ('pending', 'processing', 'completed', 'error')),
  model_used    text,
  transcript    text,
  analysis      jsonb       not null default '{}',
  error_message text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(user_id, tenant_id, post_id)
);

alter table public.market_research_gemini_analyses enable row level security;

create policy "Users can read own analyses"
  on public.market_research_gemini_analyses for select
  using (auth.uid() = user_id);

create policy "Users can insert own analyses"
  on public.market_research_gemini_analyses for insert
  with check (auth.uid() = user_id);

create policy "Users can update own analyses"
  on public.market_research_gemini_analyses for update
  using (auth.uid() = user_id);

create index if not exists idx_gemini_analyses_user_tenant
  on public.market_research_gemini_analyses (user_id, tenant_id);
