begin;
-- Planner updates one participant group/direction under the row lock.
-- Another group's concurrent save is preserved; conflicting edits are rejected.
create function public.save_visit_journey_group(p_visit uuid,p_participants text[],p_direction text,p_expected jsonb,p_legs jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare v public.visits; previous jsonb; expected_group jsonb; actual_group jsonb; kept jsonb; leg jsonb;
begin
 if public.my_profile_id()is null or not public.is_couple_member()then raise exception 'Accesso non consentito';end if;
 if p_participants is null or cardinality(p_participants)not between 1 and 2 or array_position(p_participants,null)is not null
 or cardinality(p_participants)<>(select count(distinct x)from unnest(p_participants)x)
 or p_direction is null or p_direction not in('out','back')
 or jsonb_typeof(p_expected)is distinct from 'array' or jsonb_typeof(p_legs)is distinct from 'array'
 or jsonb_array_length(p_legs)not between 1 and 40 then raise exception 'Gruppo di percorso non valido';end if;
 for leg in select value from jsonb_array_elements(p_legs)loop
  if leg->>'direction'is distinct from p_direction or jsonb_typeof(leg->'participants')is distinct from 'array'
   or not(leg->'participants' @> to_jsonb(p_participants)and leg->'participants' <@ to_jsonb(p_participants))then raise exception 'Tratta estranea al gruppo';end if;
 end loop;
 select * into v from public.visits where id=p_visit for update;
 if not found then raise exception 'Incontro non disponibile';end if;
 previous:=coalesce(v.journey_plan->'legs','[]'::jsonb);
 select coalesce(jsonb_agg(value order by ord),'[]')into actual_group from jsonb_array_elements(previous)with ordinality t(value,ord)
 where value->>'direction'=p_direction and value->'participants' @> to_jsonb(p_participants)and value->'participants' <@ to_jsonb(p_participants);
 select coalesce(jsonb_agg(value order by ord),'[]')into expected_group from jsonb_array_elements(p_expected)with ordinality t(value,ord)
 where value->>'direction'=p_direction and value->'participants' @> to_jsonb(p_participants)and value->'participants' <@ to_jsonb(p_participants);
 if actual_group is distinct from expected_group then raise exception 'Questo percorso è stato modificato su un altro dispositivo. Chiudi e riapri il pianificatore prima di riprovare.'using errcode='40001';end if;
 select coalesce(jsonb_agg(value order by ord),'[]')into kept from jsonb_array_elements(previous)with ordinality t(value,ord)
 where not(value->>'direction'=p_direction and value->'participants' @> to_jsonb(p_participants)and value->'participants' <@ to_jsonb(p_participants));
 update public.visits set journey_plan=jsonb_build_object('version',1,'counting','shared-once','legs',kept||p_legs)where id=p_visit;
 if not found then raise exception 'Salvataggio non consentito';end if;
end $$;
revoke all on function public.save_visit_journey_group(uuid,text[],text,jsonb,jsonb)from public,anon;
grant execute on function public.save_visit_journey_group(uuid,text[],text,jsonb,jsonb)to authenticated;

-- Manual editor intentionally replaces the whole plan, but only its opened version.
create function public.save_visit_journey_checked(p_visit uuid,p_expected jsonb,p_legs jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare v public.visits;
begin
 if public.my_profile_id()is null or not public.is_couple_member()then raise exception 'Accesso non consentito';end if;
 select * into v from public.visits where id=p_visit for update;
 if not found then raise exception 'Incontro non disponibile';end if;
 if coalesce(v.journey_plan->'legs','[]'::jsonb)is distinct from p_expected then raise exception 'Il percorso è cambiato. Chiudi e riapri le distanze prima di confermare.'using errcode='40001';end if;
 update public.visits set journey_plan=jsonb_build_object('version',1,'counting','shared-once','legs',p_legs)where id=p_visit;
 if not found then raise exception 'Salvataggio non consentito';end if;
end $$;
revoke all on function public.save_visit_journey_checked(uuid,jsonb,jsonb)from public,anon;
grant execute on function public.save_visit_journey_checked(uuid,jsonb,jsonb)to authenticated;
commit;
