begin;
create table public.anniversaries (
 id uuid primary key default gen_random_uuid(),author_id uuid not null references public.users(id),
 title text not null check(length(btrim(title))between 1 and 80),first_day date not null check(first_day>=date'1900-01-01'),
 annual boolean not null default true,emoji text not null default '❤️'check(emoji in('❤️','🎂','💍','✨','🎉')),
 notify boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.anniversaries enable row level security;
create policy anniversary_read on public.anniversaries for select to authenticated using(public.is_couple_member());
grant select on public.anniversaries to authenticated;
create function public.anniversary_occurrence(p_first date,p_year integer)returns date
language sql immutable set search_path=public as $$
 select make_date(p_year,extract(month from p_first)::int,least(extract(day from p_first)::int,
 extract(day from(make_date(p_year,extract(month from p_first)::int,1)+interval'1 month'-interval'1 day'))::int))
$$;
create function public.save_anniversary(p_title text,p_first date,p_annual boolean,p_emoji text,p_notify boolean,p_id uuid default null)returns uuid
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id(); rid uuid;
begin
 if p_first is null or p_first>current_date+interval'10 years'then raise exception 'Data non valida';end if;
 if p_id is null then insert into public.anniversaries(author_id,title,first_day,annual,emoji,notify)values(me,btrim(p_title),p_first,p_annual,p_emoji,p_notify)returning id into rid;
 else update public.anniversaries set title=btrim(p_title),first_day=p_first,annual=p_annual,emoji=p_emoji,notify=p_notify,updated_at=now()where id=p_id and author_id=me returning id into rid;
 if rid is null then raise exception 'Puoi modificare solo le tue ricorrenze';end if;end if;return rid;
end $$;
create function public.delete_anniversary(p_id uuid)returns void
language plpgsql security definer set search_path=public as $$
begin delete from public.anniversaries where id=p_id and author_id=public.my_profile_id();if not found then raise exception 'Puoi eliminare solo le tue ricorrenze';end if;end $$;
create function public.process_anniversary_jobs()returns void
language plpgsql security definer set search_path=public as $$
declare today date:=(now()at time zone'Europe/Rome')::date; a public.anniversaries; person record; claimed integer;
begin
 if (now()at time zone'Europe/Rome')::time<time'09:00'then return;end if;
 for a in select * from public.anniversaries where notify and first_day<=today and
 ((annual and public.anniversary_occurrence(first_day,extract(year from today)::int)=today)or(not annual and first_day=today))loop
 insert into public.feature_job_runs(job,day)values('anniversary-'||a.id,today)on conflict do nothing;get diagnostics claimed=row_count;
 if claimed>0 then for person in select id from public.users loop perform public.queue_feature_notification(person.id,a.emoji||' Una giornata speciale','Oggi avete una ricorrenza da celebrare insieme.','anniversary','/ricorrenze');end loop;end if;
 end loop;
end $$;
create or replace function public.process_feature_jobs()returns void
language plpgsql security definer set search_path=public as $$
begin
 if not pg_try_advisory_xact_lock(hashtext('pulse-relationship-jobs'))then return;end if;
 perform public.process_feature_jobs_core();perform public.process_reminder_jobs();perform public.process_remote_date_jobs();perform public.process_anniversary_jobs();
end $$;
revoke all on function public.save_anniversary(text,date,boolean,text,boolean,uuid),public.delete_anniversary(uuid),public.process_anniversary_jobs()from public,anon,authenticated;
grant execute on function public.save_anniversary(text,date,boolean,text,boolean,uuid),public.delete_anniversary(uuid)to authenticated;
grant execute on function public.process_anniversary_jobs()to service_role;
alter publication supabase_realtime add table public.anniversaries;
commit;
