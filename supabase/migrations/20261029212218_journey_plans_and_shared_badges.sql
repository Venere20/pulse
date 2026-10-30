begin;
alter table public.visits add column journey_plan jsonb;
alter table public.visits add column journey_totals jsonb;
alter table public.visits add column travel_preferences jsonb not null default '{}';
alter table public.visits add column cover_photo_settings jsonb;

create function public.validate_visit_journey() returns trigger language plpgsql set search_path=public as $$
declare leg jsonb; seen text[]:='{}'; pid text; people text[]; total bigint:=0; shared bigint:=0; outward bigint:=0; backward bigint:=0; distance bigint;
begin
 if new.journey_plan is null then new.journey_totals:=null;return new;end if;
 if jsonb_typeof(new.journey_plan) is distinct from 'object' or new.journey_plan->>'version' is distinct from '1' or new.journey_plan->>'counting' is distinct from 'shared-once'
 or jsonb_typeof(new.journey_plan->'legs') is distinct from 'array' or jsonb_array_length(new.journey_plan->'legs') not between 1 and 40 or octet_length(new.journey_plan::text)>30000 then raise exception 'Percorso non valido';end if;
 for leg in select value from jsonb_array_elements(new.journey_plan->'legs') loop
  if not coalesce(leg->>'id' ~ '^[a-zA-Z0-9_-]{1,60}$',false) or leg->>'id'=any(seen) then raise exception 'Tratta non valida o duplicata';end if;
  seen:=array_append(seen,leg->>'id');
  if not coalesce(leg->>'direction' in('out','back'),false) or not coalesce(leg->>'source' in('api','reference','manual'),false)
   or not coalesce(leg->>'mode' in('Treno','Metro','Auto','Bus','Traghetto','Aliscafo','Cammino','Aereo','Misto','Non specificato'),false)
   or coalesce(length(leg->>'from'),0) not between 1 and 120 or coalesce(length(leg->>'to'),0) not between 1 and 120
   or jsonb_typeof(leg->'distance_m') is distinct from 'number' then raise exception 'Dettagli della tratta non validi';end if;
  if (leg->>'distance_m')::numeric<>trunc((leg->>'distance_m')::numeric) or (leg->>'distance_m')::numeric not between 0 and 30000000 then raise exception 'Distanza non valida';end if;
  distance:=(leg->>'distance_m')::bigint;
  if jsonb_typeof(leg->'participants') is distinct from 'array' or jsonb_array_length(leg->'participants') not between 1 and 2 then raise exception 'Partecipanti non validi';end if;
  people:='{}';
  for pid in select jsonb_array_elements_text(leg->'participants') loop
   if pid=any(people) or not exists(select 1 from public.users where id::text=pid) then raise exception 'Partecipanti non validi';end if;
   people:=array_append(people,pid);
  end loop;
  total:=total+distance;if cardinality(people)=2 then shared:=shared+distance;end if;
  if leg->>'direction'='out' then outward:=outward+distance;else backward:=backward+distance;end if;
 end loop;
 -- Reconstruct the summary; supplied totals and timestamps are never trusted.
 new.journey_plan:=jsonb_build_object('version',1,'counting','shared-once','confirmed_at',now(),'meeting_point',new.meeting_point,'legs',new.journey_plan->'legs');
 new.journey_totals:=jsonb_build_object('version',1,'total_m',total,'shared_m',shared,'out_m',outward,'back_m',backward,'meeting_point',new.meeting_point);
 return new;
end $$;
revoke all on function public.validate_visit_journey() from public,anon,authenticated;
create trigger validate_visit_journey before insert or update of journey_plan,journey_totals on public.visits for each row execute function public.validate_visit_journey();

create function public.validate_visit_travel_preferences() returns trigger language plpgsql set search_path=public as $$
declare item record; me uuid; mode text;
begin
 if jsonb_typeof(new.travel_preferences) is distinct from 'object' or octet_length(new.travel_preferences::text)>2000 then raise exception 'Mezzi non validi';end if;
 if current_user not in('postgres','service_role','supabase_admin') then
  me:=public.my_profile_id();if me is null or not public.is_couple_member() then raise exception 'Accesso non consentito';end if;
  if tg_op='UPDATE' and (new.travel_preferences-me::text) is distinct from (old.travel_preferences-me::text) then raise exception 'Puoi modificare solo i tuoi mezzi';end if;
  if tg_op='INSERT' and (new.travel_preferences-me::text)<>'{}'::jsonb then raise exception 'Puoi modificare solo i tuoi mezzi';end if;
 end if;
 for item in select * from jsonb_each(new.travel_preferences) loop
  if not exists(select 1 from public.users where id::text=item.key) or jsonb_typeof(item.value) is distinct from 'array' or jsonb_array_length(item.value)>8 then raise exception 'Mezzi non validi';end if;
  if (select count(*)<>count(distinct value)from jsonb_array_elements_text(item.value)) then raise exception 'Mezzi duplicati';end if;
  for mode in select jsonb_array_elements_text(item.value) loop
   if mode is null or mode not in('Treno','Metro','Auto','Bus','Traghetto','Aliscafo','Cammino','Aereo') then raise exception 'Mezzo non valido';end if;
  end loop;
 end loop;
 return new;
end $$;
revoke all on function public.validate_visit_travel_preferences() from public,anon,authenticated;
create trigger validate_visit_travel_preferences before insert or update of travel_preferences on public.visits for each row execute function public.validate_visit_travel_preferences();

create function public.set_my_visit_transport(p_visit uuid,p_modes text[]) returns void language plpgsql security invoker set search_path=public as $$
declare me uuid:=public.my_profile_id();
begin
 if me is null or not public.is_couple_member() then raise exception 'Accesso non consentito';end if;
 update public.visits set travel_preferences=jsonb_set(travel_preferences,array[me::text],to_jsonb(coalesce(p_modes,'{}')),true)where id=p_visit;
 if not found then raise exception 'Incontro non disponibile';end if;
end $$;
revoke all on function public.set_my_visit_transport(uuid,text[]) from public,anon;
grant execute on function public.set_my_visit_transport(uuid,text[]) to authenticated;

create function public.save_visit_journey(p_visit uuid,p_legs jsonb) returns void language plpgsql security invoker set search_path=public as $$
begin
 if public.my_profile_id() is null or not public.is_couple_member() then raise exception 'Accesso non consentito';end if;
 update public.visits set journey_plan=jsonb_build_object('version',1,'counting','shared-once','legs',p_legs)where id=p_visit;
 if not found then raise exception 'Incontro non disponibile';end if;
end $$;
revoke all on function public.save_visit_journey(uuid,jsonb) from public,anon;
grant execute on function public.save_visit_journey(uuid,jsonb) to authenticated;

insert into public.badge_defs(id,family,tier,title,description,emoji,metric,threshold,sort)values
 ('shared_km_500','shared_km',1,'Stessa strada · 500 km','500 km percorsi insieme in incontri conclusi. Andata e ritorno separati; le tratte condivise contano una volta.','🥉','shared_km',500,25),
 ('shared_km_2000','shared_km',2,'Compagni di viaggio · 2.000 km','2.000 km insieme, esclusi i tragitti personali per raggiungervi. Contano anche gli incontri passati con percorsi confermati.','🥈','shared_km',2000,26),
 ('shared_km_10000','shared_km',3,'Il mondo insieme · 10.000 km','10.000 km insieme. Non si ricavano km condivisi da vecchie distanze generiche: servono tratte confermate.','🥇','shared_km',10000,27);

-- Reuse the same crop/rotation validation already used by capsules and story.
create function public.validate_visit_cover_layout() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='UPDATE' and row(new.cover_source,new.cover_storage_path,new.cover_remote_url) is distinct from row(old.cover_source,old.cover_storage_path,old.cover_remote_url)then new.cover_photo_settings:=null;end if;
 if new.cover_photo_settings is not null then
  new.cover_photo_settings:=public.checked_photo_settings(jsonb_build_object('cover',new.cover_photo_settings),array['cover'])->'cover';
 end if;return new;
end $$;
revoke all on function public.validate_visit_cover_layout() from public,anon,authenticated;
create trigger validate_visit_cover_layout before insert or update of cover_source,cover_storage_path,cover_remote_url,cover_photo_settings on public.visits for each row execute function public.validate_visit_cover_layout();
-- Compact day/sender counters replace repeated full pulse_logs history scans.
lock table public.pulse_logs in share row exclusive mode;
create table public.pulse_daily_counts(day date not null,sender_id uuid not null references public.users(id)on delete cascade,n bigint not null check(n>0),primary key(day,sender_id));
alter table public.pulse_daily_counts enable row level security;
create policy pulse_counts_read on public.pulse_daily_counts for select to authenticated using(public.is_couple_member());
revoke all on public.pulse_daily_counts from public,anon,authenticated;
grant select on public.pulse_daily_counts to authenticated;
insert into public.pulse_daily_counts select (p.created_at at time zone 'Europe/Rome')::date,p.sender_id,count(*)from public.pulse_logs p join public.users u on u.id=p.sender_id where p.created_at is not null group by 1,2;
create function public.sync_pulse_daily_counts()returns trigger language plpgsql security definer set search_path=public as $$
declare d date;
begin
 if tg_op='UPDATE'and row(new.sender_id,new.created_at)is not distinct from row(old.sender_id,old.created_at)then return new;end if;
 if tg_op in('DELETE','UPDATE') and old.sender_id is not null and old.created_at is not null then
  d:=(old.created_at at time zone'Europe/Rome')::date;
  -- Serialize updates to the same day/person, including deletion of its last row.
  perform pg_advisory_xact_lock(hashtextextended(d::text||old.sender_id::text,0));
  delete from public.pulse_daily_counts where day=d and sender_id=old.sender_id and n=1;
  if not found then update public.pulse_daily_counts set n=n-1 where day=d and sender_id=old.sender_id;end if;
 end if;
 if tg_op in('INSERT','UPDATE') and new.sender_id is not null and new.created_at is not null then
  d:=(new.created_at at time zone'Europe/Rome')::date;
  perform pg_advisory_xact_lock(hashtextextended(d::text||new.sender_id::text,0));
  insert into public.pulse_daily_counts values(d,new.sender_id,1)on conflict(day,sender_id)do update set n=pulse_daily_counts.n+1;
 end if;
 return coalesce(new,old);
end $$;
revoke all on function public.sync_pulse_daily_counts()from public,anon,authenticated;
create trigger sync_pulse_daily_counts after insert or delete or update of sender_id,created_at on public.pulse_logs for each row execute function public.sync_pulse_daily_counts();
create or replace function public.badge_pulse_history()returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if public.my_profile_id()is null or not public.is_couple_member()then raise exception 'Accesso non consentito';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('day',day,'count',n,'sender_ids',ids)order by day)from(select day,sum(n)n,jsonb_agg(sender_id order by sender_id)ids from public.pulse_daily_counts group by day)s),'[]'::jsonb)
  ||jsonb_build_array(jsonb_build_object('day',(now()at time zone'Europe/Rome')::date,'count',0,'sender_ids',jsonb_build_array(),'server_day',(now()at time zone'Europe/Rome')::date,'server_now',now(),'meta_only',true));
end $$;
revoke all on function public.badge_pulse_history()from public,anon;
grant execute on function public.badge_pulse_history()to authenticated;
insert into public.badge_defs(id,family,tier,title,description,emoji,metric,threshold,sort)values
 ('pulse_streak_3','pulse_streak',1,'Ci cerchiamo · 3 giorni','3 giornate con almeno un Pulse da ciascuno. Un giorno saltato congela; due consecutivi azzerano la streak.','🔥','pulse_streak',3,74),
 ('pulse_streak_7','pulse_streak',2,'Un gesto al giorno · 7 giorni','7 giornate completate nella stessa streak. I giorni congelati non aumentano il conteggio.','🔥','pulse_streak',7,75),
 ('pulse_streak_30','pulse_streak',3,'Un mese di Pulse · 30 giorni','30 giornate completate nella stessa streak. Il giorno è quello italiano per entrambi.','🔥','pulse_streak',30,76);
-- Older clients may still invoke this on entry: authenticate, then stay silent.
create function public.get_journey_context(p_visit uuid)returns jsonb language plpgsql security invoker set search_path=public as $$
declare me uuid:=public.my_profile_id();v public.visits;own_city text;other_city text;other_id uuid;
begin
 if me is null or not public.is_couple_member()then raise exception 'Accesso non consentito';end if;
 select * into v from public.visits where id=p_visit;
 if v.id is null then raise exception 'Incontro non disponibile';end if;
 select city into own_city from public.couple_settings where user_id=me;
 select user_id,city into other_id,other_city from public.couple_settings where user_id<>me order by user_id limit 1;
 return jsonb_build_object('me',me,'mine',jsonb_build_object('city',own_city,'modes',v.travel_preferences->me::text),'partner',jsonb_build_object('id',other_id,'city',other_city,'modes',v.travel_preferences->other_id::text));
end $$;
revoke all on function public.get_journey_context(uuid)from public,anon;
grant execute on function public.get_journey_context(uuid)to authenticated;
create or replace function public.notify_canvas_started()returns void language plpgsql security definer set search_path=public as $$
begin if public.my_profile_id()is null or not public.is_couple_member()then raise exception 'Accesso non consentito';end if;end $$;
revoke all on function public.notify_canvas_started()from public,anon;
grant execute on function public.notify_canvas_started()to authenticated;
alter table public.canvas_current add column change_notifications jsonb not null default '{}';
create function public.notify_canvas_content_changed()returns trigger language plpgsql security definer set search_path=public as $$
declare recipient uuid;last_sent timestamptz;
begin
 new.change_notifications:=old.change_notifications;
 if new.strokes is not distinct from old.strokes then return new;end if;
 if auth.uid()is null then return new;end if;
 if public.my_profile_id()is null then return new;end if;
 recipient:=public.partner_profile_id();if recipient is null then return new;end if;
 last_sent:=(old.change_notifications->>recipient::text)::timestamptz;
 if last_sent is null or last_sent<=now()-interval'15 minutes' then
  perform public.queue_feature_notification(recipient,'🎨 La lavagna è cambiata','Il partner ha modificato il disegno sulla vostra lavagna.','canvas','/canvas');
  new.change_notifications:=jsonb_set(old.change_notifications,array[recipient::text],to_jsonb(now()),true);
 end if;
 return new;
end $$;
revoke all on function public.notify_canvas_content_changed()from public,anon,authenticated;
create trigger notify_canvas_content_changed before update of strokes on public.canvas_current for each row execute function public.notify_canvas_content_changed();
commit;
