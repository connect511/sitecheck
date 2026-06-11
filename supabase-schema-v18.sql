-- v18 additions — Admin panel (run in Supabase SQL Editor, safe to re-run)

-- Lead pipeline stage per site
alter table public.sites add column if not exists lead_status text default 'new';  -- new | contacted | proposal | won | lost

-- Messages/recommendations pushed by Digistick admins to clients
create table if not exists public.admin_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  site_id     uuid references public.sites(id) on delete set null,
  title       text not null,
  body        text not null,
  kind        text not null default 'note',   -- note | recommendation | offer
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);

alter table public.admin_messages enable row level security;

-- Clients can read and mark-as-read their own messages. Only the service role (admin API) can insert.
drop policy if exists "own messages read" on public.admin_messages;
create policy "own messages read"   on public.admin_messages for select using (auth.uid() = user_id);
drop policy if exists "own messages update" on public.admin_messages;
create policy "own messages update" on public.admin_messages for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_admin_messages_user on public.admin_messages(user_id, created_at desc);
