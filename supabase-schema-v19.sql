-- v19 additions — service bookings + two-way messaging (safe to re-run)

-- 1) Two-way messages: who sent it, and let clients insert their own replies
alter table public.admin_messages add column if not exists sender text not null default 'admin';  -- admin | user

drop policy if exists "own messages insert" on public.admin_messages;
create policy "own messages insert" on public.admin_messages
  for insert with check (auth.uid() = user_id and sender = 'user');

-- 2) Service bookings with 10% advance payment
create table if not exists public.service_bookings (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  site_id         uuid references public.sites(id) on delete set null,
  service_key     text not null,
  service_name    text not null,
  member_id       text not null,
  member_name     text not null,
  price           int not null,            -- full service price (INR)
  advance_amount  int not null,            -- 10% advance charged now
  phone           text,
  status          text not null default 'pending',  -- pending | paid | confirmed | completed | cancelled
  order_id        text,                    -- Cashfree order id for the advance
  created_at      timestamptz not null default now()
);

alter table public.service_bookings enable row level security;

drop policy if exists "own bookings read" on public.service_bookings;
create policy "own bookings read" on public.service_bookings for select using (auth.uid() = user_id);
-- inserts/updates happen only via the server (service role), never directly from the browser

create index if not exists idx_bookings_user on public.service_bookings(user_id, created_at desc);
