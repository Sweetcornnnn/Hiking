insert into storage.buckets (id, name, public)
values ('journal-images', 'journal-images', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "Users can read own journal images" on storage.objects;
create policy "Users can read own journal images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'journal-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can upload own journal images" on storage.objects;
create policy "Users can upload own journal images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'journal-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update own journal images" on storage.objects;
create policy "Users can update own journal images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'journal-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'journal-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own journal images" on storage.objects;
create policy "Users can delete own journal images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'journal-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);
