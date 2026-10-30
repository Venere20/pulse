begin;
-- couple_settings.user_id is text in the live schema. Do not cast stored keys
-- to UUID: old installations may retain non-UUID keys. Pick the real partner.
create or replace function public.get_journey_context(p_visit uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare
 me uuid:=public.my_profile_id();
 other_id uuid;
 v public.visits;
 own_city text;
 other_city text;
begin
 if me is null or not public.is_couple_member() then raise exception 'Accesso non consentito';end if;
 select * into v from public.visits where id=p_visit;
 if v.id is null then raise exception 'Incontro non disponibile';end if;
 other_id:=public.partner_profile_id();
 select s.city into own_city from public.couple_settings s where s.user_id::text=me::text;
 select s.city into other_city from public.couple_settings s where s.user_id::text=other_id::text;
 return jsonb_build_object('me',me,
  'mine',jsonb_build_object('city',own_city,'modes',v.travel_preferences->me::text),
  'partner',jsonb_build_object('id',other_id,'city',other_city,'modes',v.travel_preferences->other_id::text));
end $$;
revoke all on function public.get_journey_context(uuid) from public,anon;
grant execute on function public.get_journey_context(uuid) to authenticated;
commit;
