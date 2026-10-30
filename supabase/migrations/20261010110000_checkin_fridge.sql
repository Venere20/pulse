begin;
create table public.feature_notifications (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.users(id) on delete cascade,
 title text not null,body text not null,tag text not null,url text not null,
 created_at timestamptz not null default now(),dispatched_at timestamptz,attempts integer not null default 0,last_error text
);
alter table public.feature_notifications enable row level security;
revoke all on public.feature_notifications from anon,authenticated;
create or replace function public.queue_feature_notification(p_user uuid,p_title text,p_body text,p_tag text,p_url text) returns void
language sql security definer set search_path=public as $$
 insert into public.feature_notifications(user_id,title,body,tag,url) select p_user,p_title,p_body,p_tag,p_url where p_user is not null
$$;
revoke all on function public.queue_feature_notification(uuid,text,text,text,text) from public,anon,authenticated;

create table public.safe_checkins (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.users(id) on delete cascade,
 label text not null check(length(btrim(label)) between 1 and 60),note text check(length(note)<=200),
 status text not null default 'active' check(status in ('active','alerted','arrived','cancelled','resolved','expired')),
 created_at timestamptz not null default now(),due_at timestamptz not null,
 grace_minutes integer not null check(grace_minutes between 2 and 15),extensions integer not null default 0 check(extensions between 0 and 5),
 prompted_at timestamptz,alerted_at timestamptz,second_alert_at timestamptz,closed_at timestamptz
);
create unique index checkin_one_active on public.safe_checkins(user_id) where status in ('active','alerted');
create index checkin_due on public.safe_checkins(due_at) where status in ('active','alerted');
create table public.checkin_events (
 id uuid primary key default gen_random_uuid(),checkin_id uuid references public.safe_checkins(id) on delete cascade,
 kind text not null,actor uuid references public.users(id),created_at timestamptz not null default now()
);
create table public.feature_heartbeat (id boolean primary key default true check(id),checked_at timestamptz not null);
alter table public.feature_heartbeat enable row level security;
revoke all on public.feature_heartbeat from anon,authenticated;
create or replace function public.checkin_partner_reachable() returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.users where id=public.partner_profile_id() and (nullif(expo_push_token,'') is not null or (web_push_subscription is not null and web_push_subscription<>'null'::jsonb)))
$$;
create or replace function public.start_checkin(p_label text,p_note text,p_minutes integer,p_allow_unreachable boolean default false) returns uuid
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id(); cid uuid; grace integer; notify_start boolean;
begin
 if p_minutes is null or p_minutes not between 5 and 720 then raise exception 'Durata: da 5 minuti a 12 ore'; end if;
 if not public.checkin_partner_reachable() and not p_allow_unreachable then raise exception 'Il partner non ha notifiche attive. Conferma di voler proseguire.'; end if;
 select checkin_grace_minutes,checkin_notify_start into grace,notify_start from public.feature_preferences where user_id=me;
 insert into public.safe_checkins(user_id,label,note,due_at,grace_minutes) values(me,btrim(p_label),nullif(btrim(p_note),''),now()+make_interval(mins=>p_minutes),coalesce(grace,5)) returning id into cid;
 insert into public.checkin_events(checkin_id,kind,actor) values(cid,'started',me);
 if not public.checkin_partner_reachable() then insert into public.checkin_events(checkin_id,kind)values(cid,'partner_unreachable'); end if;
 if coalesce(notify_start,true) then perform public.queue_feature_notification(public.partner_profile_id(),'🛡️ Check-in avviato','Il partner ti avviserà al suo arrivo.','checkin','/checkin'); end if;
 return cid;
end $$;
create or replace function public.update_checkin(p_id uuid,p_action text,p_minutes integer default null) returns void
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id(); c public.safe_checkins;
begin
 select * into c from public.safe_checkins where id=p_id for update;
 if c.id is null then raise exception 'Check-in non trovato'; end if;
 if p_action='extend' then
  if c.user_id<>me or c.status<>'active' or c.extensions>=5 or p_minutes is null or p_minutes not in (15,30,60) or c.due_at+make_interval(mins=>p_minutes)>c.created_at+interval '12 hours' then raise exception 'Prolungamento non consentito'; end if;
  update public.safe_checkins set due_at=due_at+make_interval(mins=>p_minutes),extensions=extensions+1,prompted_at=null where id=p_id;
 elsif p_action='arrived' then
  if c.user_id<>me or c.status not in ('active','alerted') then raise exception 'Operazione non consentita'; end if;
  update public.safe_checkins set status='arrived',closed_at=now() where id=p_id;
  perform public.queue_feature_notification(public.partner_profile_id(),'💚 È arrivato/a','Il check-in si è concluso.','checkin','/checkin');
 elsif p_action='cancel' then
  if c.user_id<>me or c.status<>'active' then raise exception 'Puoi annullare solo il tuo check-in attivo'; end if;
  update public.safe_checkins set status='cancelled',closed_at=now() where id=p_id;
 elsif p_action='resolve' then
  if c.user_id=me or c.status<>'alerted' then raise exception 'Solo il partner può risolvere un allarme'; end if;
  update public.safe_checkins set status='resolved',closed_at=now() where id=p_id;
 else raise exception 'Azione non valida'; end if;
 insert into public.checkin_events(checkin_id,kind,actor) values(p_id,p_action,me);
end $$;
create or replace function public.test_checkin_notification() returns void
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id();
begin
 perform pg_advisory_xact_lock(hashtext('checkin-test-'||me));
 if (select count(*) from public.feature_notifications where user_id=me and tag='checkin-test' and created_at>now()-interval '1 hour')>=3 then raise exception 'Massimo 3 test ogni ora'; end if;
 perform public.queue_feature_notification(me,'🛡️ Test check-in','Se leggi questo messaggio, le notifiche arrivano a questo dispositivo.','checkin-test','/checkin');
end $$;

create table public.fridge_notes (
 id uuid primary key default gen_random_uuid(),body text not null check(length(btrim(body)) between 1 and 160),
 kind text not null default 'note' check(kind in ('note','task')),color text not null check(color in ('yellow','pink','blue','green','purple','peach')),
 tilt integer not null default floor(random()*7)::integer-3 check(tilt between -3 and 3),
 created_by uuid not null references public.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 pinned boolean not null default false,done_at timestamptz,removed_at timestamptz
);
create table public.fridge_reactions(note_id uuid references public.fridge_notes(id) on delete cascade,user_id uuid references public.users(id),reaction text not null check(reaction in ('heart','smile','laugh')),primary key(note_id,user_id));
create table public.fridge_reads(user_id uuid primary key references public.users(id),seen_at timestamptz not null default now());
alter table public.fridge_reads enable row level security;
create policy own_reads on public.fridge_reads for all to authenticated using(user_id=public.my_profile_id()) with check(user_id=public.my_profile_id());
grant select,insert,update on public.fridge_reads to authenticated;
create or replace function public.create_fridge_note(p_body text,p_kind text,p_color text,p_silent boolean default false) returns uuid
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id(); nid uuid; preview boolean;
begin
 perform pg_advisory_xact_lock(hashtext('pulse-fridge'));
 if (select count(*) from public.fridge_notes where removed_at is null and done_at is null)>=30 then raise exception 'Massimo 30 post-it attivi'; end if;
 insert into public.fridge_notes(body,kind,color,created_by) values(btrim(p_body),p_kind,p_color,me) returning id into nid;
 select fridge_preview into preview from public.feature_preferences where user_id=public.partner_profile_id();
 if not p_silent then perform public.queue_feature_notification(public.partner_profile_id(),'📝 Un nuovo post-it',case when coalesce(preview,true) then left(btrim(p_body),40) else 'Ti aspetta un messaggio sul frigo.' end,'fridge','/frigo'); end if;
 return nid;
end $$;
create or replace function public.update_fridge_note(p_id uuid,p_action text,p_value text default null) returns void
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id(); n public.fridge_notes;
begin
 perform pg_advisory_xact_lock(hashtext('pulse-fridge'));
 select * into n from public.fridge_notes where id=p_id for update;
 if n.id is null then raise exception 'Post-it non trovato'; end if;
 if p_action='restore' then
  if n.removed_at is null or n.removed_at<now()-interval '7 days' then raise exception 'Ripristino non disponibile'; end if;
  if n.done_at is null and (select count(*) from public.fridge_notes where removed_at is null and done_at is null)>=30 then raise exception 'Massimo 30 post-it'; end if;
  update public.fridge_notes set removed_at=null,pinned=false,updated_at=now() where id=p_id;
 elsif n.removed_at is not null then raise exception 'Post-it rimosso';
 elsif p_action='edit' then
  if n.created_by<>me then raise exception 'Puoi modificare solo i tuoi post-it'; end if;
  update public.fridge_notes set body=btrim(p_value),updated_at=now() where id=p_id;
 elsif p_action='remove' then update public.fridge_notes set removed_at=now(),pinned=false,updated_at=now() where id=p_id;
 elsif p_action='pin' then
  if p_value not in ('true','false') or p_value is null then raise exception 'Valore non valido'; end if;
  if p_value='true' and not n.pinned and (select count(*) from public.fridge_notes where pinned and removed_at is null)>=3 then raise exception 'Massimo 3 post-it fissati'; end if;
  update public.fridge_notes set pinned=p_value::boolean,updated_at=now() where id=p_id;
 elsif p_action='done' then
  if n.kind<>'task' or p_value not in ('true','false') or p_value is null then raise exception 'Azione non valida'; end if;
  if p_value='false' and n.done_at is not null and (select count(*) from public.fridge_notes where removed_at is null and done_at is null)>=30 then raise exception 'Massimo 30 post-it'; end if;
  update public.fridge_notes set done_at=case when p_value='true' then coalesce(done_at,now()) else null end,updated_at=now() where id=p_id;
  if p_value='true' and n.done_at is null and n.created_by<>me then perform public.queue_feature_notification(n.created_by,'✅ Fatto!','Il partner ha completato un post-it.','fridge','/frigo'); end if;
 elsif p_action='react' then
  if n.created_by=me then raise exception 'Reagisci ai post-it del partner'; end if;
  if p_value is null then delete from public.fridge_reactions where note_id=p_id and user_id=me;
  else insert into public.fridge_reactions(note_id,user_id,reaction)values(p_id,me,p_value)on conflict(note_id,user_id)do update set reaction=excluded.reaction; end if;
 else raise exception 'Azione non valida'; end if;
end $$;

do $$ declare t text; begin
 foreach t in array array['safe_checkins','checkin_events','fridge_notes','fridge_reactions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy couple_read on public.%I for select to authenticated using(public.is_couple_member())',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
alter publication supabase_realtime add table public.safe_checkins,public.checkin_events,public.fridge_notes,public.fridge_reactions,public.fridge_reads;
do $$ declare f record; begin
 for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname in ('start_checkin','update_checkin','checkin_partner_reachable','test_checkin_notification','create_fridge_note','update_fridge_note') loop
  execute format('revoke all on function %s from public,anon',f.signature);execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;
commit;
