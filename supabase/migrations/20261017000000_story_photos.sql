begin;
alter table public.story_moments add column photo_paths text[] not null default '{}'
  check(cardinality(photo_paths)<=3);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('story-photos','story-photos',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy story_photos_read on storage.objects for select to authenticated
  using(bucket_id='story-photos' and public.is_couple_member());
create policy story_photos_upload on storage.objects for insert to authenticated
  with check(bucket_id='story-photos' and public.is_couple_member()
    and split_part(name,'/',1)=public.my_profile_id()::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-z-]{12,80}\.(jpg|png|webp)$');
create policy story_photos_delete on storage.objects for delete to authenticated
  using(bucket_id='story-photos' and public.is_couple_member()
    and split_part(name,'/',1)=public.my_profile_id()::text);

-- Separate RPC preserves existing clients: text-only edits keep their photos.
create function public.save_story_moment_v2(p_title text,p_day date,p_body text,p_photo_paths text[],p_id uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id();rid uuid;photo text;
begin
 if me is null or not public.is_couple_member() then raise exception 'Accesso non consentito';end if;
 if p_photo_paths is null or cardinality(p_photo_paths)>3 or array_ndims(p_photo_paths)>1
   then raise exception 'Puoi aggiungere al massimo 3 foto';end if;
 if (select count(distinct x)from unnest(p_photo_paths)x)<>cardinality(p_photo_paths)
   then raise exception 'Foto duplicate o non valide';end if;
 if p_id is not null and not exists(select 1 from public.story_moments where id=p_id and author_id=me)
   then raise exception 'Puoi modificare solo i tuoi momenti';end if;
 foreach photo in array p_photo_paths loop
  if photo is null or split_part(photo,'/',1)<>me::text
     or photo !~ '^[0-9a-f-]{36}/[0-9a-z-]{12,80}\.(jpg|png|webp)$'
     or not exists(select 1 from storage.objects where bucket_id='story-photos'and name=photo)
     then raise exception 'Fotografia non disponibile o non autorizzata';end if;
 end loop;
 rid:=public.save_story_moment(p_title,p_day,p_body,p_id);
 update public.story_moments set photo_paths=p_photo_paths where id=rid;
 return rid;
end $$;
revoke all on function public.save_story_moment_v2(text,date,text,text[],uuid)from public,anon;
grant execute on function public.save_story_moment_v2(text,date,text,text[],uuid)to authenticated;
commit;
