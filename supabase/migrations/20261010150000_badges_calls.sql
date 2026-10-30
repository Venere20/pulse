begin;
create table public.badge_defs (
 id text primary key check(id~'^[a-z0-9_]{3,40}$'),family text not null,tier smallint not null check(tier between 1 and 4),title text not null check(length(title)<=40),description text not null check(length(description)<=140),emoji text not null,metric text,threshold numeric,hidden boolean not null default false,requires_feature text,sort smallint not null default 0
);
create table public.badge_awards(badge_id text primary key references public.badge_defs(id),earned_on date not null,awarded_at timestamptz not null default now(),awarded_by uuid references public.users(id) on delete set null);
create table public.badge_reads(user_id uuid primary key references public.users(id)on delete cascade,last_seen_at timestamptz not null default '2000-01-01');
insert into public.badge_defs(id,family,tier,title,description,emoji,metric,threshold,sort)
select family||'_'||threshold,family,ordinality,title||' · '||threshold,description,'🏅',family,threshold,sort+ordinality from(
 values('visits','Incontri','Incontri conclusi insieme',array[1,5,10,25],0),('days','Giorni insieme','Giorni di calendario condivisi, senza sovrapposizioni',array[7,30,100,365],10),('km','Chilometri','Chilometri stimati di andata e ritorno',array[500,2000,10000,40075],20),('wait','Pazienza','Giorni di attesa tra due incontri',array[30,60,90],30),('streak','Costanza','Giorni consecutivi con risposte di entrambi',array[7,30,100],40),('bucket','Desideri','Desideri realizzati',array[1,5,10],50),('settlements','Squadra','Conguagli registrati',array[1,10],60),('pulses','Dolcezza','Pulse inviati da entrambi',array[100,500,1000],70)
)as catalog(family,title,description,thresholds,sort) cross join lateral unnest(thresholds)with ordinality as t(threshold,ordinality);
insert into public.badge_defs(id,family,tier,title,description,emoji,hidden,sort)values('secret_newyear','secret',1,'Capodanno insieme','Un incontro che comprende il primo gennaio','🎆',true,90),('secret_valentine','secret',1,'San Valentino insieme','Un incontro che comprende il 14 febbraio','💝',true,91);
alter table public.badge_defs enable row level security;
alter table public.badge_awards enable row level security;
alter table public.badge_reads enable row level security;
create policy badge_catalog on public.badge_defs for select to authenticated using(public.is_couple_member() and (not hidden or exists(select 1 from public.badge_awards where badge_id=id)));
create policy badge_award_read on public.badge_awards for select to authenticated using(public.is_couple_member());
create policy badge_reads_own on public.badge_reads for select to authenticated using(user_id=public.my_profile_id());
revoke all on public.badge_defs,public.badge_awards,public.badge_reads from anon,authenticated;
grant select on public.badge_defs,public.badge_awards,public.badge_reads to authenticated;
alter publication supabase_realtime add table public.badge_awards,public.badge_reads,public.feature_preferences;
create or replace function public.badge_pulse_history() returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin perform public.my_profile_id();return coalesce((select jsonb_agg(jsonb_build_object('day',days.day,'count',n)order by days.day)from(select(created_at at time zone 'Europe/Rome')::date as day,count(*)as n from public.pulse_logs group by 1)days),'[]'::jsonb);end $$;
create or replace function public.award_badges(p_awards jsonb) returns integer
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id(); item jsonb; earned date; changed integer; total integer:=0; person record;
begin
 if p_awards is null or jsonb_typeof(p_awards)<>'array' or jsonb_array_length(p_awards)>30 then raise exception 'Massimo 30 traguardi';end if;
 for item in select value from jsonb_array_elements(p_awards)loop
  earned:=(item->>'earned_on')::date;
  if earned is null or earned<date '2000-01-01' or earned>(now()at time zone'Europe/Rome')::date or not exists(select 1 from public.badge_defs where id=item->>'badge_id') then raise exception 'Traguardo o data non validi';end if;
  insert into public.badge_awards(badge_id,earned_on,awarded_by)values(item->>'badge_id',earned,me)on conflict do nothing;
  get diagnostics changed=row_count;total:=total+changed;
 end loop;
 if total>0 then
  for person in select id from public.users u where coalesce((select badges_enabled from public.feature_preferences p where p.user_id=u.id),true)loop
   perform public.queue_feature_notification(person.id,'🏅 Nuovi traguardi',total||' traguardi sbloccati insieme.','badges','/badge');
  end loop;
 end if;return total;
end $$;
create or replace function public.mark_badges_seen()returns void language plpgsql security definer set search_path=public as $$
begin insert into public.badge_reads(user_id,last_seen_at)values(public.my_profile_id(),now())on conflict(user_id)do update set last_seen_at=now();end $$;

create table public.call_log (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.users(id),day date not null,minutes integer not null check(minutes between 1 and 720),note text check(length(note)<=120),created_at timestamptz not null default now()
);
alter table public.call_log enable row level security;
create policy calls_read on public.call_log for select to authenticated using(public.is_couple_member());
revoke all on public.call_log from anon,authenticated;grant select on public.call_log to authenticated;
alter publication supabase_realtime add table public.call_log;
create or replace function public.call_log_action(p_action text,p_id uuid default null,p_day date default null,p_minutes integer default null,p_note text default null)returns void
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id();
begin
 perform pg_advisory_xact_lock(hashtext('calls-'||me));
 if p_action='delete' then delete from public.call_log where id=p_id and owner_id=me;
 elsif p_action in ('add','edit')then
  if p_day is null or p_day<date '2000-01-01' or p_day>(now()at time zone'Europe/Rome')::date then raise exception 'Data non valida';end if;
  if(select count(*)from public.call_log where owner_id=me and day=p_day and id is distinct from p_id)>=10 then raise exception 'Massimo 10 chiamate al giorno';end if;
  if p_action='add' then insert into public.call_log(owner_id,day,minutes,note)values(me,p_day,p_minutes,nullif(btrim(p_note),''));
  else update public.call_log set day=p_day,minutes=p_minutes,note=nullif(btrim(p_note),'')where id=p_id and owner_id=me;end if;
 else raise exception 'Azione non valida';end if;
end $$;
do $$declare f record;begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname in('badge_pulse_history','award_badges','mark_badges_seen','call_log_action')loop
 execute format('revoke all on function %s from public,anon',f.signature);execute format('grant execute on function %s to authenticated',f.signature);end loop;
end $$;
commit;
