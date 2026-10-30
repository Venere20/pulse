begin;
create table public.remote_dates (
 id uuid primary key default gen_random_uuid(),author_id uuid not null references public.users(id),recipient_id uuid not null references public.users(id),
 response_by uuid not null references public.users(id),title text not null check(length(btrim(title))between 1 and 80),
 kind text not null check(kind in('call','dinner','game','music')),note text not null default ''check(length(note)<=300),
 starts_at timestamptz not null,duration_minutes integer not null check(duration_minutes between 10 and 240),
 status text not null default 'proposed'check(status in('proposed','accepted','declined','cancelled','done','expired')),
 reminded_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(author_id<>recipient_id),check(response_by in(author_id,recipient_id))
);
alter table public.remote_dates enable row level security;
create policy remote_date_read on public.remote_dates for select to authenticated using(public.is_couple_member());
grant select on public.remote_dates to authenticated;
create index remote_dates_due on public.remote_dates(starts_at)where status in('proposed','accepted');
create function public.create_remote_date(p_title text,p_kind text,p_note text,p_start timestamptz,p_duration integer)returns uuid
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id(); partner uuid:=public.partner_profile_id(); rid uuid;
begin
 if p_start is null or p_start<now()+interval'5 minutes'or p_start>now()+interval'6 months'then raise exception 'Scegli un orario tra cinque minuti e sei mesi';end if;
 insert into public.remote_dates(author_id,recipient_id,response_by,title,kind,note,starts_at,duration_minutes)values(me,partner,partner,btrim(p_title),p_kind,btrim(coalesce(p_note,'')),p_start,p_duration)returning id into rid;
 perform public.queue_feature_notification(partner,'💞 Un appuntamento a distanza','Il partner ti invita a passare del tempo insieme.','remote-date','/appuntamenti');return rid;
end $$;
create function public.remote_date_action(p_id uuid,p_action text,p_start timestamptz default null)returns void
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id(); r public.remote_dates; partner uuid:=public.partner_profile_id();
begin
 select * into r from public.remote_dates where id=p_id for update;
 if r.id is null or me not in(r.author_id,r.recipient_id)then raise exception 'Appuntamento non trovato';end if;
 if p_action='cancel'and r.status in('proposed','accepted')then update public.remote_dates set status='cancelled',updated_at=now()where id=p_id;
 elsif p_action='done'and r.status='accepted'and r.starts_at<=now()then update public.remote_dates set status='done',updated_at=now()where id=p_id;
 elsif r.status='proposed'and r.response_by=me and r.starts_at>now()then
  if p_action='accept'then update public.remote_dates set status='accepted',updated_at=now()where id=p_id;
  elsif p_action='decline'then update public.remote_dates set status='declined',updated_at=now()where id=p_id;
  elsif p_action='counter'and p_start>=now()+interval'5 minutes'and p_start<=now()+interval'6 months'then update public.remote_dates set starts_at=p_start,response_by=partner,updated_at=now()where id=p_id;
  else raise exception 'Operazione o orario non valido';end if;
 else raise exception 'Operazione non consentita';end if;
 perform public.queue_feature_notification(partner,'💞 Appuntamento aggiornato','Ci sono novità sul vostro appuntamento.','remote-date','/appuntamenti');
end $$;
create function public.process_remote_date_jobs()returns void
language plpgsql security definer set search_path=public as $$
declare r public.remote_dates; person uuid;
begin
 update public.remote_dates set status='expired',updated_at=now()where status='proposed'and starts_at<=now();
 for r in select * from public.remote_dates where status='accepted'and reminded_at is null and starts_at<=now()+interval'10 minutes'for update skip locked loop
 update public.remote_dates set reminded_at=now()where id=r.id;
 if r.starts_at>now()-interval'10 minutes'then
 foreach person in array array[r.author_id,r.recipient_id]loop perform public.queue_feature_notification(person,'💞 È quasi il vostro momento','Il vostro appuntamento a distanza sta per iniziare.','remote-date','/appuntamenti');end loop;end if;
 end loop;
end $$;
create or replace function public.process_feature_jobs()returns void
language plpgsql security definer set search_path=public as $$
begin
 if not pg_try_advisory_xact_lock(hashtext('pulse-relationship-jobs'))then return;end if;
 perform public.process_feature_jobs_core();perform public.process_reminder_jobs();perform public.process_remote_date_jobs();
end $$;
revoke all on function public.create_remote_date(text,text,text,timestamptz,integer),public.remote_date_action(uuid,text,timestamptz),public.process_remote_date_jobs()from public,anon,authenticated;
grant execute on function public.create_remote_date(text,text,text,timestamptz,integer),public.remote_date_action(uuid,text,timestamptz)to authenticated;
grant execute on function public.process_remote_date_jobs()to service_role;
alter publication supabase_realtime add table public.remote_dates;
commit;
