begin;

alter table public.story_moments add column photo_settings jsonb not null default '{}';
alter table public.capsule_contents add column photo_settings jsonb not null default '{}';

-- Share the same bounded, non-destructive presentation format as visit memories.
create function public.checked_photo_settings(p_settings jsonb,p_paths text[]) returns jsonb
language plpgsql immutable set search_path=public as $$
declare item record;c jsonb;k text;n numeric;result jsonb;
begin
 if p_settings is null or jsonb_typeof(p_settings) is distinct from 'object'
   or octet_length(p_settings::text)>16000 then raise exception 'Impostazioni foto non valide';end if;
 -- Old clients may remove a photo without sending the associated layout.
 select coalesce(jsonb_object_agg(key,value),'{}') into result
 from jsonb_each(p_settings) where key=any(coalesce(p_paths,'{}'));
 if (select count(*)from jsonb_each(result))>3 then raise exception 'Massimo tre impostazioni foto';end if;
 for item in select * from jsonb_each(result)loop
  if jsonb_typeof(item.value) is distinct from 'object'
    or not coalesce(item.value->>'mode' in('fixed','adaptive'),false)
    or jsonb_typeof(item.value->'crop') is distinct from 'object' then raise exception 'Formato foto non valido';end if;
  if item.value ? 'rotation' then
   if jsonb_typeof(item.value->'rotation') is distinct from 'number' then raise exception 'Rotazione non valida';end if;
   if (item.value->>'rotation')::numeric not in(0,90,180,270)then raise exception 'Rotazione non valida';end if;
  end if;
  c:=item.value->'crop';
  foreach k in array array['x','y','width','height']loop
   if jsonb_typeof(c->k)is distinct from 'number' then raise exception 'Ritaglio non valido';end if;
   n:=(c->>k)::numeric;
   if n<0 or n>1 or(k in('width','height')and n<0.05)then raise exception 'Ritaglio fuori dai limiti';end if;
  end loop;
  if(c->>'x')::numeric+(c->>'width')::numeric>1.000001
    or(c->>'y')::numeric+(c->>'height')::numeric>1.000001 then raise exception 'Ritaglio fuori dalla fotografia';end if;
 end loop;
 return result;
end $$;
revoke all on function public.checked_photo_settings(jsonb,text[])from public,anon,authenticated;

create function public.validate_shared_photo_settings()returns trigger
language plpgsql set search_path=public as $$
begin
 new.photo_settings:=public.checked_photo_settings(new.photo_settings,new.photo_paths);
 return new;
end $$;
revoke all on function public.validate_shared_photo_settings()from public,anon,authenticated;
create trigger story_photo_settings before insert or update of photo_paths,photo_settings
 on public.story_moments for each row execute function public.validate_shared_photo_settings();
create trigger capsule_photo_settings before insert or update of photo_paths,photo_settings
 on public.capsule_contents for each row execute function public.validate_shared_photo_settings();

-- Keep v2 available for already installed clients. Text, photos and layout save atomically.
create function public.save_story_moment_v3(p_title text,p_day date,p_body text,p_photo_paths text[],p_photo_settings jsonb,p_id uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare rid uuid;
begin
 rid:=public.save_story_moment_v2(p_title,p_day,p_body,p_photo_paths,p_id);
 update public.story_moments set photo_settings=p_photo_settings where id=rid;
 return rid;
end $$;
revoke all on function public.save_story_moment_v3(text,date,text,text[],jsonb,uuid)from public,anon;
grant execute on function public.save_story_moment_v3(text,date,text,text[],jsonb,uuid)to authenticated;

-- Contents stay behind their existing RLS: the recipient cannot see the crop or the photo before opening.
create function public.seal_capsule_v2(p_id uuid,p_label text,p_kind text,p_unlock_at timestamptz,p_visit uuid,p_hint text,p_body text,p_photo_settings jsonb,p_notify boolean default false)
returns void language plpgsql security definer set search_path=public as $$
declare c public.time_capsules;me uuid:=public.my_profile_id();
begin
 select * into c from public.time_capsules where id=p_id for update;
 if me is null or not public.is_couple_member()or c.author_id is distinct from me
   or public.capsule_is_open(p_id)then raise exception 'Capsula non modificabile';end if;
 update public.capsule_contents set photo_settings=p_photo_settings,updated_at=now()where capsule_id=p_id;
 perform public.seal_capsule(p_id,p_label,p_kind,p_unlock_at,p_visit,p_hint,p_body,p_notify);
end $$;
revoke all on function public.seal_capsule_v2(uuid,text,text,timestamptz,uuid,text,text,jsonb,boolean)from public,anon;
grant execute on function public.seal_capsule_v2(uuid,text,text,timestamptz,uuid,text,text,jsonb,boolean)to authenticated;
commit;
