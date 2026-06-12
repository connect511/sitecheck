-- v20: chat file attachments
alter table admin_messages add column if not exists file_url text;
alter table admin_messages add column if not exists file_name text;

insert into storage.buckets (id, name, public, file_size_limit)
values ('chat-files', 'chat-files', true, 10485760)
on conflict (id) do nothing;

drop policy if exists "chat files upload" on storage.objects;
create policy "chat files upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-files');

drop policy if exists "chat files read" on storage.objects;
create policy "chat files read" on storage.objects
  for select using (bucket_id = 'chat-files');
