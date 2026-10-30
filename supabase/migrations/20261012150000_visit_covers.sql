begin;

-- Copertina indipendente dalle fotografie dei ricordi.
alter table public.visits
  add column if not exists cover_source text,
  add column if not exists cover_storage_path text,
  add column if not exists cover_remote_url text,
  add column if not exists cover_attribution text;

-- NULL mantiene compatibili gli incontri preesistenti.
alter table public.visits
  add constraint visits_cover_source_check
  check (
    cover_source is null
    or cover_source in ('personal', 'destination', 'default')
  );

-- Nuovo bucket: privato. Non modifica il bucket pubblico meetings.
insert into storage.buckets (id, name, public)
values ('visit-covers', 'visit-covers', false)
on conflict (id) do nothing;

-- Se il bucket era già presente, rendilo privato.
update storage.buckets
set public = false
where id = 'visit-covers';

-- L'accesso è riservato agli account della coppia.
-- Ogni oggetto deve stare sotto il percorso:
-- <visit-id>/<nomefile>.jpg|png|webp

create policy visit_covers_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'visit-covers'
  and public.is_couple_member()
  and exists (
    select 1
    from public.visits v
    where v.id::text = split_part(name, '/', 1)
  )
);

create policy visit_covers_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'visit-covers'
  and public.is_couple_member()
  and name ~
    '^[0-9a-fA-F-]{36}/[A-Za-z0-9_-]+\.(jpg|png|webp)$'
  and exists (
    select 1
    from public.visits v
    where v.id::text = split_part(name, '/', 1)
  )
);

create policy visit_covers_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'visit-covers'
  and public.is_couple_member()
  and exists (
    select 1
    from public.visits v
    where v.id::text = split_part(name, '/', 1)
  )
);

commit;
