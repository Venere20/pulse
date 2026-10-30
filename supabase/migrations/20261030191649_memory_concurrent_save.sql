begin;
-- Compare only memory fields: editing another part of the meeting is unrelated.
create function public.save_visit_memory(p_visit uuid, p_expected jsonb, p_note text, p_photos text[], p_settings jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare v public.visits; actual jsonb;
begin
 if public.my_profile_id() is null or not public.is_couple_member() then raise exception 'Accesso non consentito';end if;
 select * into v from public.visits where id=p_visit for update;
 if not found then raise exception 'Incontro non disponibile';end if;
 actual:=jsonb_build_object('note',coalesce(v.memory_notes,''),'photos',coalesce(v.memory_photos,'{}'::text[]),'settings',coalesce(v.memory_photo_settings,'{}'::jsonb));
 if actual is distinct from p_expected then
  raise exception 'Il partner ha modificato questo ricordo. La tua bozza è conservata: copia il pensiero, poi annulla e riapri per vedere le nuove foto.' using errcode='40001';
 end if;
 if p_photos is null or cardinality(p_photos)>5 or array_position(p_photos,null) is not null then raise exception 'Foto non valide: massimo cinque';end if;
 update public.visits set memory_notes=nullif(btrim(p_note),''),memory_photos=p_photos,memory_photo_settings=coalesce(p_settings,'{}'::jsonb) where id=p_visit;
 if not found then raise exception 'Salvataggio non consentito';end if;
end $$;
revoke all on function public.save_visit_memory(uuid,jsonb,text,text[],jsonb) from public,anon;
grant execute on function public.save_visit_memory(uuid,jsonb,text,text[],jsonb) to authenticated;
commit;
