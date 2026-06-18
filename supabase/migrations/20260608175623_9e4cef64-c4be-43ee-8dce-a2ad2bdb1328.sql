
-- Enable pgvector
create extension if not exists vector;

-- ============ PROFILES (plan + billing) ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  plan text not null default 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  validations_used_this_period integer not null default 0,
  period_started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "users read own profile" on public.profiles for select using (auth.uid() = id);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "users insert own profile" on public.profiles for insert with check (auth.uid() = id);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ SOURCES (for RAG) ============
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('pdf','url','text')),
  title text not null,
  url text,
  content text not null,
  status text not null default 'ready',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.sources to authenticated;
grant all on public.sources to service_role;
alter table public.sources enable row level security;
create policy "users manage own sources" on public.sources for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger sources_updated_at before update on public.sources
  for each row execute function public.set_updated_at();

-- ============ SOURCE CHUNKS (vectorized) ============
create table public.source_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.source_chunks to authenticated;
grant all on public.source_chunks to service_role;
alter table public.source_chunks enable row level security;
create policy "users manage own chunks" on public.source_chunks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index source_chunks_embedding_idx on public.source_chunks using hnsw (embedding vector_cosine_ops);
create index source_chunks_user_idx on public.source_chunks (user_id);

create or replace function public.match_user_source_chunks(
  p_user_id uuid,
  query_embedding vector(1536),
  match_count integer default 6
) returns table (
  id uuid,
  source_id uuid,
  content text,
  similarity float
) language sql stable security definer set search_path = public as $$
  select c.id, c.source_id, c.content,
         1 - (c.embedding <=> query_embedding) as similarity
  from public.source_chunks c
  where c.user_id = p_user_id and c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- ============ BUSINESS PLANS ============
create table public.business_plans (
  id uuid primary key default gen_random_uuid(),
  validation_id uuid not null references public.validations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'running',
  plan jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.business_plans to authenticated;
grant all on public.business_plans to service_role;
alter table public.business_plans enable row level security;
create policy "users manage own business plans" on public.business_plans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger business_plans_updated_at before update on public.business_plans
  for each row execute function public.set_updated_at();
create index business_plans_validation_idx on public.business_plans (validation_id);
