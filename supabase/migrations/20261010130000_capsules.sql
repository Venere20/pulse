begin;
create table public.time_capsules (
 id uuid primary key default gen_random_uuid(),author_id uuid not null references public.users(id) on delete cascade,
 recipient_id uuid not null references public.users(id) on delete cascade,label text check(length(label)<=40),
 unlock_kind text not null default 'date' check(unlock_kind in ('date','visit','next_visit','manual')),unlock_at timestamptz,
 visit_id uuid references public.visits(id) on delete set null,manual_hint text check(length(manual_hint)<=40),
 has_text boolean not null default false,photo_count smallint not null default 0 check(photo_count between 0 and 3),
 status text not null default 'draft' check(status in ('draft','sealed','open')),opened_at timestamptz,read_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(author_id<>recipient_id),check(status='draft' or ((unlock_kind='date')=(unlock_at is not null)))
);
create table public.capsule_contents (
 capsule_id uuid primary key references public.time_capsules(id) on delete cascade,
 body text check(length(body)<=1000),photo_paths text[] not null default '{}' check(cardinality(photo_paths)<=3),updated_at timestamptz not null default now()
);
create table public.capsule_cleanup(path text primary key,created_at timestamptz not null default now());
alter table public.capsule_cleanup enable row level security;
revoke all on public.capsule_cleanup from anon,authenticated;
create or replace function public.visit_start_at(p_visit uuid) returns timestamptz
language sql stable security definer set search_path=public as $$
 select ((start_date at time zone 'UTC')::date+case when arrival_time~'^([01]?[0-9]|2[0-3]):[0-5][0-9]$' then arrival_time::time else time '00:00' end) at time zone 'Europe/Rome' from public.visits where id=p_visit
$$;
revoke all on function public.visit_start_at(uuid) from public,anon,authenticated;
create or replace function public.capsule_is_open(p_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select public.is_couple_member() and exists(select 1 from public.time_capsules c where c.id=p_id and c.status<>'draft' and
 (c.status='open' or (c.unlock_kind='date' and c.unlock_at<=now()) or (c.unlock_kind in ('visit','next_visit') and c.visit_id is not null and public.visit_start_at(c.visit_id)<=now())))
$$;
alter table public.time_capsules enable row level security;
alter table public.capsule_contents enable row level security;
create policy capsule_meta_read on public.time_capsules for select to authenticated using(author_id=public.my_profile_id() or(recipient_id=public.my_profile_id() and status<>'draft'));
create policy capsule_content_read on public.capsule_contents for select to authenticated using(exists(select 1 from public.time_capsules c where c.id=capsule_id and (c.author_id=public.my_profile_id() or(c.recipient_id=public.my_profile_id() and public.capsule_is_open(c.id)))));
revoke all on public.time_capsules,public.capsule_contents from anon,authenticated;
grant select on public.time_capsules,public.capsule_contents to authenticated;
alter publication supabase_realtime add table public.time_capsules;

create or replace function public.create_capsule_draft() returns uuid
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id(); cid uuid; partner uuid:=public.partner_profile_id();
begin
 perform pg_advisory_xact_lock(hashtext('capsule-'||me));
 if partner is null then raise exception 'Serve un partner'; end if;
 if(select count(*) from public.time_capsules where author_id=me and status in ('draft','sealed'))>=20 then raise exception 'Massimo 20 capsule in preparazione o sigillate'; end if;
 insert into public.time_capsules(author_id,recipient_id)values(me,partner)returning id into cid;
 insert into public.capsule_contents(capsule_id)values(cid);
 return cid;
end $$;
-- Reserve object names before upload: an upload policy can then enforce the
-- three-photo limit even when several devices upload concurrently.
create or replace function public.set_capsule_photos(p_id uuid,p_paths text[]) returns void
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id(); c public.time_capsules; photo_path text;
begin
 select * into c from public.time_capsules where id=p_id for update;
 if c.author_id is distinct from me or public.capsule_is_open(p_id) then raise exception 'Capsula non modificabile'; end if;
 if p_paths is null or cardinality(p_paths)>3 then raise exception 'Massimo 3 foto'; end if;
 if(select count(distinct x) from unnest(p_paths)x)<>cardinality(p_paths) then raise exception 'Percorsi duplicati'; end if;
 foreach photo_path in array p_paths loop
  if photo_path is null or photo_path!~('^'||p_id||'/[a-zA-Z0-9_-]+\.(jpg|png|webp)$') then raise exception 'Percorso non valido'; end if;
 end loop;
 insert into public.capsule_cleanup(path)select unnest(photo_paths)from public.capsule_contents where capsule_id=p_id
 on conflict do nothing;
 delete from public.capsule_cleanup where path=any(p_paths);
 update public.capsule_contents set photo_paths=p_paths,updated_at=now() where capsule_id=p_id;
 update public.time_capsules set photo_count=cardinality(p_paths),updated_at=now()where id=p_id;
end $$;
create or replace function public.seal_capsule(p_id uuid,p_label text,p_kind text,p_unlock_at timestamptz,p_visit uuid,p_hint text,p_body text,p_notify boolean default false) returns void
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id(); c public.time_capsules; paths text[]; path text; vid uuid;
begin
 select * into c from public.time_capsules where id=p_id for update;
 if c.author_id is distinct from me or public.capsule_is_open(p_id) then raise exception 'Capsula non modificabile'; end if;
 if c.created_at<now()-interval '24 hours' and c.status='draft' then raise exception 'Bozza scaduta'; end if;
 select photo_paths into paths from public.capsule_contents where capsule_id=p_id;
 if nullif(btrim(p_body),'') is null and cardinality(paths)=0 then raise exception 'Aggiungi testo o una foto'; end if;
 foreach path in array paths loop
  if not exists(select 1 from storage.objects where bucket_id='capsules' and name=path) then raise exception 'Caricamento foto incompleto'; end if;
 end loop;
 if p_kind='date' then
  if p_unlock_at is null or p_unlock_at<now()+interval '10 minutes' then raise exception 'Scegli almeno 10 minuti nel futuro'; end if;
 elsif p_kind='visit' then
  if p_visit is null or public.visit_start_at(p_visit) is null or public.visit_start_at(p_visit)<=now() then raise exception 'Scegli un incontro futuro'; end if;vid:=p_visit;
 elsif p_kind='next_visit' then
  select id into vid from public.visits where public.visit_start_at(id)>now() and coalesce(status,'planned')<>'concluded' order by start_date limit 1;
 elsif p_kind<>'manual' or p_kind is null then raise exception 'Condizione non valida'; end if;
 update public.capsule_contents set body=nullif(btrim(p_body),''),updated_at=now() where capsule_id=p_id;
 update public.time_capsules set label=nullif(btrim(p_label),''),unlock_kind=p_kind,unlock_at=case when p_kind='date' then p_unlock_at end,visit_id=vid,manual_hint=nullif(btrim(p_hint),''),has_text=nullif(btrim(p_body),'') is not null,status='sealed',updated_at=now()where id=p_id;
 if p_notify and c.status='draft' then perform public.queue_feature_notification(c.recipient_id,'🎁 Una capsula per te','Il partner ti ha lasciato una sorpresa.','capsule','/capsule'); end if;
end $$;
create or replace function public.open_capsule(p_id uuid,p_unlock_manual boolean default false) returns void
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id(); c public.time_capsules;
begin
 select * into c from public.time_capsules where id=p_id for update;
 if c.recipient_id is distinct from me or c.status='draft' then raise exception 'Capsula non disponibile'; end if;
 if p_unlock_manual and c.unlock_kind='manual' then update public.time_capsules set status='open',opened_at=coalesce(opened_at,now())where id=p_id;
 elsif not public.capsule_is_open(p_id) then raise exception 'Capsula ancora sigillata'; end if;
 update public.time_capsules set status='open',opened_at=coalesce(opened_at,now()),read_at=coalesce(read_at,now()),updated_at=now()where id=p_id;
 if c.read_at is null then perform public.queue_feature_notification(c.author_id,'💞 Capsula letta','Il partner ha aperto la tua capsula.','capsule','/capsule'); end if;
end $$;
create or replace function public.delete_capsule(p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id(); c public.time_capsules;
begin
 select * into c from public.time_capsules where id=p_id for update;
 if c.author_id is distinct from me then raise exception 'Puoi eliminare solo le tue capsule'; end if;
 insert into public.capsule_cleanup(path)select name from storage.objects where bucket_id='capsules' and name like p_id||'/%' on conflict do nothing;
 delete from public.time_capsules where id=p_id;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('capsules','capsules',false,5242880,array['image/jpeg','image/png','image/webp'])on conflict(id)do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create or replace function public.capsule_storage_access(p_path text,p_write boolean) returns boolean
language plpgsql stable security definer set search_path=public as $$
declare c public.time_capsules; cid text:=split_part(p_path,'/',1); me uuid;
begin
 if cid!~'^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$' then return false; end if;
 me:=public.my_profile_id();select * into c from public.time_capsules where id=cid::uuid;
 if p_write then return c.author_id=me and not public.capsule_is_open(c.id) and exists(select 1 from public.capsule_contents where capsule_id=c.id and p_path=any(photo_paths)); end if;
 return c.author_id=me or(c.recipient_id=me and public.capsule_is_open(c.id));
end $$;
create policy capsule_photo_read on storage.objects for select to authenticated using(bucket_id='capsules' and public.capsule_storage_access(name,false));
create policy capsule_photo_insert on storage.objects for insert to authenticated with check(bucket_id='capsules' and public.capsule_storage_access(name,true));
create policy capsule_photo_delete on storage.objects for delete to authenticated using(bucket_id='capsules' and public.capsule_storage_access(name,true));
do $$ declare f record;begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname in('capsule_is_open','create_capsule_draft','set_capsule_photos','seal_capsule','open_capsule','delete_capsule','capsule_storage_access')loop
 execute format('revoke all on function %s from public,anon',f.signature);execute format('grant execute on function %s to authenticated',f.signature);end loop;
end $$;
commit;
