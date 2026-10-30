begin;
-- Upload reservations are separate from the published capsule contents.
create table public.capsule_photo_uploads (
 path text primary key,
 capsule_id uuid not null references public.time_capsules(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.capsule_photo_uploads enable row level security;
revoke all on public.capsule_photo_uploads from public,anon,authenticated;

create function public.reserve_capsule_photo(p_id uuid,p_path text)returns void
language plpgsql security definer set search_path=public as $$
declare c public.time_capsules;me uuid:=public.my_profile_id();
begin
 select * into c from public.time_capsules where id=p_id for update;
 if c.author_id is distinct from me or public.capsule_is_open(p_id)then raise exception 'Capsula non modificabile';end if;
 if p_path is null or p_path!~('^'||p_id||'/[a-zA-Z0-9_-]+\.(jpg|png|webp)$')then raise exception 'Percorso non valido';end if;
 delete from public.capsule_photo_uploads where capsule_id=p_id and created_at<now()-interval'24 hours';
 if exists(select 1 from public.capsule_contents where capsule_id=p_id and p_path=any(photo_paths))then raise exception 'Fotografia già presente';end if;
 if exists(select 1 from public.capsule_photo_uploads where path=p_path)then return;end if;
 if(select count(*)from public.capsule_photo_uploads where capsule_id=p_id)>=3 then raise exception 'Massimo tre foto in preparazione';end if;
 insert into public.capsule_photo_uploads(path,capsule_id)values(p_path,p_id);
 delete from public.capsule_cleanup where path=p_path;
end $$;

create function public.abandon_capsule_photos(p_id uuid,p_paths text[])returns void
language plpgsql security definer set search_path=public as $$
declare c public.time_capsules;
begin
 select * into c from public.time_capsules where id=p_id for update;
 if c.author_id is distinct from public.my_profile_id()then raise exception 'Accesso non consentito';end if;
 insert into public.capsule_cleanup(path)select path from public.capsule_photo_uploads
 where capsule_id=p_id and path=any(p_paths)
 and not exists(select 1 from public.capsule_contents where capsule_id=p_id and path=any(photo_paths))on conflict do nothing;
 delete from public.capsule_photo_uploads where capsule_id=p_id and path=any(p_paths);
end $$;

create or replace function public.capsule_storage_access(p_path text,p_write boolean)returns boolean
language plpgsql stable security definer set search_path=public as $$
declare c public.time_capsules;cid text:=split_part(p_path,'/',1);me uuid;
begin
 if cid!~'^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$'then return false;end if;
 me:=public.my_profile_id();select * into c from public.time_capsules where id=cid::uuid;
 if p_write then return c.author_id=me and not public.capsule_is_open(c.id)and(
  exists(select 1 from public.capsule_contents where capsule_id=c.id and p_path=any(photo_paths))or
  exists(select 1 from public.capsule_photo_uploads where capsule_id=c.id and path=p_path and created_at>now()-interval'24 hours'));end if;
 return c.author_id=me or(c.recipient_id=me and public.capsule_is_open(c.id)
  and exists(select 1 from public.capsule_contents where capsule_id=c.id and p_path=any(photo_paths)));
end $$;

create function public.seal_capsule_v3(p_id uuid,p_label text,p_kind text,p_unlock_at timestamptz,p_visit uuid,p_hint text,p_body text,p_paths text[],p_photo_settings jsonb,p_notify boolean default false)returns void
language plpgsql security definer set search_path=public as $$
declare c public.time_capsules;photo text;
begin
 select * into c from public.time_capsules where id=p_id for update;
 if c.author_id is distinct from public.my_profile_id()or public.capsule_is_open(p_id)then raise exception 'Capsula non modificabile';end if;
 foreach photo in array coalesce(p_paths,'{}')loop
  if not exists(select 1 from public.capsule_contents where capsule_id=p_id and photo=any(photo_paths))
   and not exists(select 1 from public.capsule_photo_uploads where capsule_id=p_id and path=photo and created_at>now()-interval'24 hours')then raise exception 'Fotografia non autorizzata';end if;
 end loop;
 perform public.set_capsule_photos(p_id,p_paths);
 perform public.seal_capsule_v2(p_id,p_label,p_kind,p_unlock_at,p_visit,p_hint,p_body,p_photo_settings,p_notify);
 -- Discard this capsule's unused staged files only after successful confirmation.
 insert into public.capsule_cleanup(path)select path from public.capsule_photo_uploads where capsule_id=p_id and not(path=any(p_paths))on conflict do nothing;
 delete from public.capsule_photo_uploads where capsule_id=p_id;
end $$;
revoke all on function public.reserve_capsule_photo(uuid,text),public.abandon_capsule_photos(uuid,text[]),public.seal_capsule_v3(uuid,text,text,timestamptz,uuid,text,text,text[],jsonb,boolean)from public,anon;
grant execute on function public.reserve_capsule_photo(uuid,text),public.abandon_capsule_photos(uuid,text[]),public.seal_capsule_v3(uuid,text,text,timestamptz,uuid,text,text,text[],jsonb,boolean)to authenticated;
commit;
