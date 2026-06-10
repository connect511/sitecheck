-- v17 additions — run in Supabase SQL Editor (safe to re-run)
alter table public.sites add column if not exists scan_freq text default 'off';   -- off | weekly | monthly
alter table public.sites add column if not exists alerts_on boolean default false;
alter table public.sites add column if not exists last_auto_scan timestamptz;
alter table public.sites add column if not exists alert_email text;
