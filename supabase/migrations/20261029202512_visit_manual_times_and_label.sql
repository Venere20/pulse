begin;

alter table public.visits add column is_adult boolean not null default false;

-- Invoker preserves the visits/bucket RLS policies; membership is checked too.
create function public.update_visit_actual_times(p_visit uuid, p_start timestamptz, p_end timestamptz default null)
returns public.visits language plpgsql security invoker set search_path = public as $$
declare
  me uuid := public.my_profile_id();
  v public.visits;
begin
  if me is null or not public.is_couple_member() then raise exception 'Accesso non consentito'; end if;
  select * into v from public.visits where id = p_visit for update;
  if v.id is null then raise exception 'Incontro non trovato'; end if;
  if p_start is null or not isfinite(p_start) or p_start > now() then
    raise exception 'L’inizio effettivo deve essere una data valida non futura';
  end if;
  if p_end is not null and (not isfinite(p_end) or p_end < p_start or p_end > now()) then
    raise exception 'La fine deve essere successiva o uguale all’inizio e non futura';
  end if;
  if p_end is null and (v.status = 'concluded' or v.ended_at is not null
    or (v.timing_mode <> 'manual' and (v.end_date at time zone 'UTC')::date < (now() at time zone 'Europe/Rome')::date)) then
    raise exception 'Per un incontro già concluso indica anche la fine';
  end if;
  update public.visits set timing_mode = 'manual', started_at = p_start, started_by = me,
    ended_at = p_end, ended_by = case when p_end is null then null else me end,
    status = case when p_end is null then 'planned' else 'concluded' end
    where id = p_visit returning * into v;
  if p_end is not null then
    update public.bucket_list set is_completed = true where not is_completed and id in
      (select bucket_item_id from public.visit_bucket_items where visit_id = p_visit);
  end if;
  return v;
end;
$$;
revoke all on function public.update_visit_actual_times(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.update_visit_actual_times(uuid,timestamptz,timestamptz) to authenticated;

commit;
