-- Upsert (upload with upsert:true) needs SELECT + INSERT + UPDATE on storage.objects.
-- DIG-5 only had insert/update/delete; replace of restored product images returned 400.

drop policy if exists "media_authenticated_select" on storage.objects;

create policy "media_authenticated_select"
on storage.objects
for select
to authenticated
using (bucket_id = 'media');
