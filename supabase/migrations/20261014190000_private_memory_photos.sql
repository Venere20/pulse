-- Deploy the signed-image web/native clients BEFORE applying this migration.
-- Stable legacy URLs in visits remain identifiers; clients sign their paths.
begin;
update storage.buckets set public=false,
 allowed_mime_types=array['image/jpeg','image/png','image/webp'],
 file_size_limit=8388608
where id='meetings';

-- Replace legacy PUBLIC rules: making the bucket private alone is insufficient.
drop policy if exists meetings_read on storage.objects;
drop policy if exists meetings_insert on storage.objects;
drop policy if exists meetings_update on storage.objects;
drop policy if exists meetings_delete on storage.objects;
create policy meetings_read on storage.objects for select to authenticated
 using(bucket_id='meetings' and public.is_couple_member());
create policy meetings_insert on storage.objects for insert to authenticated
 with check(bucket_id='meetings' and public.is_couple_member());
create policy meetings_update on storage.objects for update to authenticated
 using(bucket_id='meetings' and public.is_couple_member())
 with check(bucket_id='meetings' and public.is_couple_member());
create policy meetings_delete on storage.objects for delete to authenticated
 using(bucket_id='meetings' and public.is_couple_member());

-- Close a legacy table left exposed.
alter table public.events enable row level security;
drop policy if exists events_couple_only on public.events;
create policy events_couple_only on public.events for all to authenticated
 using(public.is_couple_member()) with check(public.is_couple_member());
revoke all on public.events from anon;
commit;
