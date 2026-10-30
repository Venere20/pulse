begin;

create table public.checkin_routes (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.users(id) on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 60),
 icon text not null default '🏠' check(length(icon) between 1 and 16),
 origin text not null default '' check(length(origin)<=100),
 destination text not null check(length(btrim(destination)) between 1 and 60),
 minutes integer not null check(minutes between 5 and 720),
 grace_minutes integer not null default 10 check(grace_minutes between 5 and 30),
 note text not null default '' check(length(note)<=200),
 quick_start boolean not null default false,
 favorite boolean not null default false,
 position integer not null default 0 check(position between 0 and 9999),
 created_at timestamptz not null default now()
);
alter table public.checkin_routes enable row level security;
revoke all on public.checkin_routes from public,anon,authenticated;
grant select on public.checkin_routes to authenticated;
create policy own_routes on public.checkin_routes for select to authenticated
 using(user_id=public.my_profile_id());
alter publication supabase_realtime add table public.checkin_routes;

alter table public.safe_checkins add column departed_at timestamptz;
alter table public.safe_checkins add column origin text not null default '' check(length(origin)<=100);
alter table public.safe_checkins add column flow_version integer not null default 1 check(flow_version in(1,2));
alter table public.safe_checkins drop constraint safe_checkins_grace_minutes_check;
alter table public.safe_checkins add constraint safe_checkins_grace_minutes_check check(grace_minutes between 2 and 30);

create function public.save_checkin_route(p_route jsonb,p_id uuid default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id(); rid uuid;
begin
 perform pg_advisory_xact_lock(hashtext('checkin-routes-'||me));
 if p_route is null or jsonb_typeof(p_route)<>'object' then raise exception 'Tragitto non valido';end if;
 if p_id is null then
  if (select count(*) from public.checkin_routes where user_id=me)>=50 then raise exception 'Puoi salvare fino a 50 tragitti';end if;
  insert into public.checkin_routes(user_id,name,icon,origin,destination,minutes,grace_minutes,note,quick_start,favorite,position)
  values(me,btrim(p_route->>'name'),coalesce(p_route->>'icon','🏠'),coalesce(p_route->>'origin',''),btrim(p_route->>'destination'),(p_route->>'minutes')::integer,(p_route->>'grace_minutes')::integer,coalesce(p_route->>'note',''),coalesce((p_route->>'quick_start')::boolean,false),coalesce((p_route->>'favorite')::boolean,false),coalesce((p_route->>'position')::integer,0)) returning id into rid;
 else
  update public.checkin_routes set name=btrim(p_route->>'name'),icon=coalesce(p_route->>'icon','🏠'),origin=coalesce(p_route->>'origin',''),destination=btrim(p_route->>'destination'),minutes=(p_route->>'minutes')::integer,grace_minutes=(p_route->>'grace_minutes')::integer,note=coalesce(p_route->>'note',''),quick_start=coalesce((p_route->>'quick_start')::boolean,false),favorite=coalesce((p_route->>'favorite')::boolean,false),position=coalesce((p_route->>'position')::integer,0)
  where id=p_id and user_id=me returning id into rid;
  if rid is null then raise exception 'Tragitto non disponibile';end if;
 end if;
 return rid;
end $$;

create function public.delete_checkin_route(p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id();
begin
 delete from public.checkin_routes where id=p_id and user_id=me;
 if not found then raise exception 'Tragitto non disponibile';end if;
end $$;

-- Separate signature preserves existing clients. Overrides are journey snapshots,
-- never writes back into the saved route.
create function public.start_checkin_v2(p_label text,p_note text,p_minutes integer,p_departed_at timestamptz,p_grace integer,p_origin text default '',p_allow_unreachable boolean default false) returns uuid
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id(); cid uuid; due timestamptz;
begin
 if p_departed_at is null or not isfinite(p_departed_at) or p_departed_at>now()+interval'1 minute' or p_departed_at<now()-interval'12 hours' then raise exception 'Scegli una partenza tra le ultime 12 ore e adesso';end if;
 if p_minutes is null or p_minutes not between 5 and 720 or p_grace is null or p_grace not between 5 and 30 then raise exception 'Durata 5–720 minuti; margine 5–30 minuti';end if;
 due:=p_departed_at+make_interval(mins=>p_minutes);
 if due<=now() then raise exception 'L’arrivo previsto deve essere ancora nel futuro';end if;
 -- Reuse reachability, start notification and uniqueness checks atomically.
 cid:=public.start_checkin(p_label,p_note,p_minutes,p_allow_unreachable);
 update public.safe_checkins set departed_at=p_departed_at,due_at=due,grace_minutes=p_grace,origin=coalesce(p_origin,''),flow_version=2 where id=cid and user_id=me;
 return cid;
end $$;

-- V2 allows recovery after an alert, plus cancellation of one's own open journey.
-- Legacy function still supplies ownership, events and arrival notification.
create function public.update_checkin_v2(p_id uuid,p_action text,p_minutes integer default null) returns void
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id(); c public.safe_checkins; due timestamptz;
begin
 select * into c from public.safe_checkins where id=p_id for update;
 if c.id is null then raise exception 'Check-in non trovato';end if;
 if p_action in('extend','cancel') then
  if c.user_id<>me or c.status not in('active','alerted') then raise exception 'Operazione non consentita';end if;
  if p_action='extend' then
   if p_minutes is null or p_minutes not in(15,30,60) or c.extensions>=5 then raise exception 'Prolungamento non consentito';end if;
   due:=greatest(c.due_at,now())+make_interval(mins=>p_minutes);
   if due>coalesce(c.departed_at,c.created_at)+interval'12 hours' then raise exception 'Durata massima: 12 ore';end if;
   update public.safe_checkins set due_at=due,status='active',extensions=extensions+1,prompted_at=null,alerted_at=null,second_alert_at=null where id=p_id;
   perform public.queue_feature_notification(public.partner_profile_id(),'🛡️ Orario di arrivo aggiornato','Il partner ha aggiornato l’orario previsto del check-in.','checkin','/checkin');
  else
   update public.safe_checkins set status='cancelled',closed_at=now() where id=p_id;
   perform public.queue_feature_notification(public.partner_profile_id(),'🛡️ Check-in annullato','Il partner ha annullato il check-in.','checkin','/checkin');
  end if;
  insert into public.checkin_events(checkin_id,kind,actor)values(p_id,p_action,me);
 else
  -- Legacy resolve requires a real partner, not merely any registered profile.
  if p_action='resolve' and c.user_id<>public.partner_profile_id() then raise exception 'Operazione non consentita';end if;
  perform public.update_checkin(p_id,p_action,p_minutes);
 end if;
end $$;

create function public.process_checkin_jobs_v2() returns void
language plpgsql security definer set search_path=public as $$
declare c public.safe_checkins;
begin
 for c in select * from public.safe_checkins where status in('active','alerted') for update skip locked loop
  if c.status='alerted' and c.alerted_at+interval'6 hours'<=now() then
   update public.safe_checkins set status='expired',closed_at=now() where id=c.id;
   insert into public.checkin_events(checkin_id,kind)values(c.id,'expired');
  elsif c.status='active' and c.due_at+make_interval(mins=>c.grace_minutes)<=now() then
   update public.safe_checkins set status='alerted',alerted_at=now(),prompted_at=coalesce(prompted_at,now()) where id=c.id;
   insert into public.checkin_events(checkin_id,kind)values(c.id,'alerted');
   perform public.queue_feature_notification(c.user_id,'🛡️ Arrivo non confermato','Non hai ancora confermato l’arrivo. Abbiamo avvisato il partner.','checkin-alert','/checkin');
   perform public.queue_feature_notification((select id from public.users where id<>c.user_id order by id limit 1),'🛡️ Arrivo non confermato','Il partner non ha ancora confermato l’arrivo. Prova a contattarlo.','checkin-alert','/checkin');
  elsif c.status='active' and c.due_at<=now() and c.prompted_at is null then
   update public.safe_checkins set prompted_at=now() where id=c.id;
   perform public.queue_feature_notification(c.user_id,'🛡️ Sei arrivato/a?','Conferma l’arrivo oppure aggiorna l’orario previsto.','checkin','/checkin');
  end if;
 end loop;
end $$;

-- Replace only the check-in loop, preserving all other jobs and scheduler locks.
do $$ declare definition text; changed text; begin
 select pg_get_functiondef('public.process_feature_jobs_core()'::regprocedure) into definition;
 changed:=regexp_replace(definition,' for c in select \* from public.safe_checkins[\s\S]*? end loop;\s* for proposal',' perform public.process_checkin_jobs_v2();'||E'\n for proposal');
 if changed=definition then raise exception 'Check-in worker block not found; no changes applied';end if;
 execute changed;
end $$;

revoke all on function public.save_checkin_route(jsonb,uuid),public.delete_checkin_route(uuid),public.start_checkin_v2(text,text,integer,timestamptz,integer,text,boolean),public.update_checkin_v2(uuid,text,integer),public.process_checkin_jobs_v2() from public,anon,authenticated;
grant execute on function public.save_checkin_route(jsonb,uuid),public.delete_checkin_route(uuid),public.start_checkin_v2(text,text,integer,timestamptz,integer,text,boolean),public.update_checkin_v2(uuid,text,integer) to authenticated;
grant execute on function public.process_checkin_jobs_v2() to service_role;
commit;
