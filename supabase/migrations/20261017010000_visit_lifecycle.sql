begin;
alter table public.visits add column timing_mode text not null default 'scheduled' check(timing_mode in('scheduled','manual'));
alter table public.visits add column started_at timestamptz;
alter table public.visits add column ended_at timestamptz;
alter table public.visits add column started_by uuid references public.users(id);
alter table public.visits add column ended_by uuid references public.users(id);
alter table public.visits add constraint visit_actual_order check(ended_at is null or started_at is null or ended_at>=started_at);

-- Capsule unlocks follow the actual arrival when manual timing is selected.
create or replace function public.visit_start_at(p_visit uuid) returns timestamptz
language sql stable security definer set search_path=public as $$
 select case when timing_mode='manual' then coalesce(started_at,'infinity'::timestamptz)
 else ((start_date at time zone 'UTC')::date+case when arrival_time~'^([01]?[0-9]|2[0-3]):[0-5][0-9]$' then arrival_time::time else time '00:00' end) at time zone 'Europe/Rome' end
 from public.visits where id=p_visit
$$;

-- An older app must not close a manually managed visit just because its date passed.
create function public.protect_manual_visit_end()returns trigger language plpgsql set search_path=public as $$
begin
 if old.timing_mode='manual'and new.status='concluded'and new.ended_at is null then new.status:=old.status;end if;
 return new;
end $$;
revoke all on function public.protect_manual_visit_end()from public,anon,authenticated;
create trigger protect_manual_visit_end before update of status on public.visits for each row execute function public.protect_manual_visit_end();

create or replace function public.open_packing_list(p_visit uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id();lid uuid;
begin
 perform pg_advisory_xact_lock(hashtext('packing-'||p_visit||me));
 if not exists(select 1 from public.visits where id=p_visit
   and (timing_mode='manual' or (end_date at time zone'UTC')::date>=(now()at time zone'Europe/Rome')::date)
   and coalesce(status,'planned')<>'concluded')then raise exception 'Incontro concluso o non disponibile';end if;
 select id into lid from public.packing_lists where visit_id=p_visit and owner_id=me;
 if lid is null then
  insert into public.packing_lists(visit_id,owner_id)values(p_visit,me)returning id into lid;
  insert into public.packing_progress(visit_id,owner_id,checked,total)values(p_visit,me,0,0);
  insert into public.packing_items(list_id,label,quantity,category,source,source_key)select lid,label,quantity,category,'default','default-'||id from public.packing_defaults where owner_id=me;
 end if;return lid;
end $$;

create function public.visit_lifecycle(p_visit uuid,p_action text)returns public.visits
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id();v public.visits;today date:=(now()at time zone'Europe/Rome')::date;
begin
 if me is null or not public.is_couple_member() then raise exception 'Accesso non consentito';end if;
 if p_action is null or p_action not in('manual','scheduled','start','finish')then raise exception 'Azione non valida';end if;
 select * into v from public.visits where id=p_visit for update;
 if v.id is null then raise exception 'Incontro non trovato';end if;
 if v.status='concluded' or v.ended_at is not null then
  if p_action='finish'then return v;end if;
  raise exception 'Incontro già concluso';
 end if;
 if p_action in('manual','scheduled')then
  if p_action='scheduled'and v.started_at is not null then raise exception 'L’incontro è già iniziato: concludilo manualmente';end if;
  update public.visits set timing_mode=p_action where id=p_visit returning * into v;
 elsif p_action='start'then
  if v.started_at is null then
   update public.visits set timing_mode='manual',started_at=now(),started_by=me where id=p_visit returning * into v;
  end if;
 elsif p_action='finish'then
  if v.started_at is null and (v.timing_mode='manual' or public.visit_start_at(v.id)>now() or (v.end_date at time zone'UTC')::date<today)
    then raise exception 'Avvia prima l’incontro';end if;
  update public.visits set status='concluded',ended_at=now(),ended_by=me where id=p_visit returning * into v;
  update public.bucket_list set is_completed=true where id in(select bucket_item_id from public.visit_bucket_items where visit_id=p_visit);
 end if;
 return v;
end $$;
revoke all on function public.visit_lifecycle(uuid,text)from public,anon;
grant execute on function public.visit_lifecycle(uuid,text)to authenticated;
commit;
