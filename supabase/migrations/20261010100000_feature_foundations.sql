-- Pulse is a single, two-profile household. New writes derive identity from auth,
-- never from a caller supplied user_id. Apply after the existing auth migration.
begin;
create or replace function public.my_profile_id() returns uuid
language plpgsql stable security definer set search_path=public as $$
declare me uuid;
begin
  select id into me from public.users where auth_user_id=auth.uid();
  if me is null then raise exception 'Accesso richiesto'; end if;
  return me;
end $$;
revoke all on function public.my_profile_id() from public, anon;
grant execute on function public.my_profile_id() to authenticated;

create or replace function public.partner_profile_id() returns uuid
language sql stable security definer set search_path=public as $$
  select id from public.users where id<>public.my_profile_id() order by id limit 1
$$;
revoke all on function public.partner_profile_id() from public,anon;
grant execute on function public.partner_profile_id() to authenticated;

create table public.feature_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  checkin_grace_minutes integer not null default 5 check(checkin_grace_minutes between 2 and 15),
  checkin_notify_start boolean not null default true,
  fridge_preview boolean not null default true,
  badges_enabled boolean not null default true,
  canvas_haptics boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.feature_preferences enable row level security;
create policy preferences_own on public.feature_preferences for all to authenticated
using(user_id=public.my_profile_id()) with check(user_id=public.my_profile_id());
grant select,insert,update on public.feature_preferences to authenticated;

-- Harden existing household tables, including installations that never ran the
-- optional manual lockdown. Keep legacy non-private features compatible.
do $$ declare t text; p record; begin
  foreach t in array array['visits','trip_expenses','settlements','bucket_list','visit_bucket_items','pulse_logs','daily_answers','couple_settings','game_matches','wyr_answers'] loop
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on public.%I',p.policyname,t);
    end loop;
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon',t);
    execute format('create policy household on public.%I for all to authenticated using(public.is_couple_member()) with check(public.is_couple_member())',t);
  end loop;
  for p in select policyname from pg_policies where schemaname='public' and tablename='users' loop
    execute format('drop policy %I on public.users',p.policyname);
  end loop;
end $$;
alter table public.users enable row level security;
revoke all on public.users from anon,authenticated;
grant select(id,name,current_status,status_updated_at),update(name,expo_push_token,web_push_subscription) on public.users to authenticated;
create policy users_read on public.users for select to authenticated using(public.is_couple_member());
create policy users_update_own on public.users for update to authenticated using(id=public.my_profile_id()) with check(id=public.my_profile_id());
alter table public.users alter column current_status drop not null;
alter table public.users alter column current_status drop default;
alter table public.users add column status_expires_at timestamptz;
grant select(status_expires_at) on public.users to authenticated;
create or replace function public.set_my_status(p_status text,p_minutes integer default null) returns void
language plpgsql security definer set search_path=public as $$
declare ttl integer;
begin
  if p_status is not null and p_status not in ('home','office','study','gym','out','traveling','flying','together','sleep') then raise exception 'Stato non valido'; end if;
  ttl:=coalesce(p_minutes,case p_status when 'office' then 600 when 'study' then 600 when 'gym' then 120 when 'out' then 240 when 'traveling' then 720 when 'flying' then 720 when 'together' then 1440 when 'sleep' then 540 end);
  if ttl is not null and ttl not between 5 and 10080 then raise exception 'Durata non valida'; end if;
  update public.users set current_status=p_status,status_updated_at=now(),status_expires_at=case when p_status is not null and ttl is not null then now()+make_interval(mins=>ttl) end where id=public.my_profile_id();
end $$;
revoke all on function public.set_my_status(text,integer) from public,anon;
grant execute on function public.set_my_status(text,integer) to authenticated;

create table public.date_proposals (
  id uuid primary key default gen_random_uuid(), title text not null check(length(btrim(title)) between 1 and 80),
  place text check(length(place)<=80),note text check(length(note)<=500),created_by uuid not null references public.users(id),
  status text not null default 'open' check(status in ('open','confirmed','cancelled','expired')),
  visit_id uuid references public.visits(id) on delete set null,confirmed_option_id uuid,
  nudged_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.date_options (
  id uuid primary key default gen_random_uuid(),proposal_id uuid not null references public.date_proposals(id) on delete cascade,
  start_date date not null,end_date date not null,proposed_by uuid not null references public.users(id),withdrawn_at timestamptz,
  check(end_date>=start_date and end_date-start_date<=60)
);
create unique index date_options_unique on public.date_options(proposal_id,start_date,end_date) where withdrawn_at is null;
create table public.date_votes (
  option_id uuid references public.date_options(id) on delete cascade,user_id uuid references public.users(id),
  vote text not null check(vote in ('yes','maybe','no')),primary key(option_id,user_id)
);
create or replace function public.create_date_proposal(p_title text,p_place text,p_note text,p_options jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id(); pid uuid; opt jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('pulse-date-proposals'));
  if jsonb_typeof(p_options)<>'array' or jsonb_array_length(p_options) not between 1 and 4 then raise exception 'Scegli da 1 a 4 opzioni'; end if;
  if (select count(*) from public.date_proposals where status='open')>=3 then raise exception 'Sono già aperte 3 proposte'; end if;
  insert into public.date_proposals(title,place,note,created_by) values(btrim(p_title),nullif(btrim(p_place),''),nullif(btrim(p_note),''),me) returning id into pid;
  for opt in select value from jsonb_array_elements(p_options) loop
    if (opt->>'start_date')::date<(now() at time zone 'Europe/Rome')::date then raise exception 'Data già passata'; end if;
    insert into public.date_options(proposal_id,start_date,end_date,proposed_by) values(pid,(opt->>'start_date')::date,(opt->>'end_date')::date,me);
  end loop;
  perform public.queue_feature_notification(public.partner_profile_id(),'📅 Nuove date proposte','Scegliamo quando vederci?','proposal','/proposte/'||pid);
  return pid;
end $$;
create or replace function public.change_date_option(p_proposal uuid,p_start date,p_end date,p_replace uuid default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id(); oid uuid; st text;
begin
  select status into st from public.date_proposals where id=p_proposal for update;
  if st is distinct from 'open' then raise exception 'Proposta non aperta'; end if;
  if p_start<(now() at time zone 'Europe/Rome')::date then raise exception 'Data già passata'; end if;
  if p_replace is not null then
    update public.date_options set withdrawn_at=now() where id=p_replace and proposal_id=p_proposal and proposed_by=me and withdrawn_at is null;
    if not found then raise exception 'Puoi modificare solo le tue opzioni'; end if;
  end if;
  if (select count(*) from public.date_options where proposal_id=p_proposal and withdrawn_at is null)>=4 then raise exception 'Massimo 4 opzioni'; end if;
  insert into public.date_options(proposal_id,start_date,end_date,proposed_by) values(p_proposal,p_start,p_end,me) returning id into oid;
  perform public.queue_feature_notification(public.partner_profile_id(),'📅 Nuova opzione','Il partner ha aggiornato le date.','proposal','/proposte/'||p_proposal);
  return oid;
end $$;
create or replace function public.vote_date_option(p_option uuid,p_vote text) returns void
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id(); opt public.date_options; st text;
begin
  select * into opt from public.date_options where id=p_option;
  select status into st from public.date_proposals where id=opt.proposal_id for update;
  if st is distinct from 'open' or opt.withdrawn_at is not null or opt.start_date<(now() at time zone 'Europe/Rome')::date then raise exception 'Opzione non disponibile'; end if;
  insert into public.date_votes(option_id,user_id,vote) values(p_option,me,p_vote) on conflict(option_id,user_id) do update set vote=excluded.vote;
  if (select count(distinct user_id) from public.date_votes where option_id=p_option)=2 then
    perform public.queue_feature_notification(public.partner_profile_id(),'📅 Voti completati','Le risposte sulle date sono pronte.','proposal','/proposte/'||opt.proposal_id);
  end if;
end $$;
create or replace function public.confirm_date_option(p_option uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id(); opt public.date_options; prop public.date_proposals; vid uuid;
begin
  select * into opt from public.date_options where id=p_option;
  select * into prop from public.date_proposals where id=opt.proposal_id for update;
  if prop.status='confirmed' then return prop.visit_id; end if;
  if prop.status is distinct from 'open' or opt.withdrawn_at is not null or opt.start_date<(now() at time zone 'Europe/Rome')::date then raise exception 'Opzione non disponibile'; end if;
  if (select count(*) from public.date_votes where option_id=p_option and vote in ('yes','maybe'))<>2 or exists(select 1 from public.date_votes where option_id=p_option and vote='no') then raise exception 'Servono due voti favorevoli'; end if;
  insert into public.visits(title,start_date,end_date,location,notes,created_by,status) values(prop.title,opt.start_date::timestamp at time zone 'UTC',opt.end_date::timestamp at time zone 'UTC',prop.place,prop.note,me,'planned') returning id into vid;
  update public.date_proposals set status='confirmed',visit_id=vid,confirmed_option_id=p_option,updated_at=now() where id=prop.id;
  perform public.queue_feature_notification(public.partner_profile_id(),'💞 Incontro confermato','Le date sono nel calendario.','proposal','/visit/'||vid);
  return vid;
end $$;
create or replace function public.cancel_date_proposal(p_proposal uuid) returns void
language plpgsql security definer set search_path=public as $$
begin perform public.my_profile_id(); update public.date_proposals set status='cancelled',updated_at=now() where id=p_proposal and status='open'; end $$;

-- Only RPC writes; Postgres changes are sufficient for shared, non-private data.
do $$ declare t text; f record; begin
  foreach t in array array['date_proposals','date_options','date_votes'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy couple_read on public.%I for select to authenticated using(public.is_couple_member())',t);
    execute format('revoke all on public.%I from anon,authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t); end if;
  end loop;
  for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname in ('create_date_proposal','change_date_option','vote_date_option','confirm_date_option','cancel_date_proposal') loop
    execute format('revoke all on function %s from public,anon',f.signature);
    execute format('grant execute on function %s to authenticated',f.signature);
  end loop;
end $$;
commit;

