begin;
alter table public.anniversaries add column monthly boolean not null default false;
alter table public.anniversaries add constraint anniversary_one_repeat check(not(annual and monthly));

create function public.save_anniversary_v2(p_title text,p_first date,p_repeat text,p_emoji text,p_notify boolean,p_id uuid default null)returns uuid
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id();rid uuid;
begin
 if p_repeat is null or p_repeat not in('yearly','monthly','once')then raise exception 'Ripetizione non valida';end if;
 if p_first is null or p_first<date'1900-01-01' or p_first>current_date+interval'10 years'then raise exception 'Data non valida';end if;
 if p_title is null or length(btrim(p_title))not between 1 and 80 then raise exception 'Inserisci un titolo da 1 a 80 caratteri';end if;
 if p_id is null then
  insert into public.anniversaries(author_id,title,first_day,annual,monthly,emoji,notify)
  values(me,btrim(p_title),p_first,p_repeat='yearly',p_repeat='monthly',p_emoji,p_notify)returning id into rid;
 else
  update public.anniversaries set title=btrim(p_title),first_day=p_first,annual=p_repeat='yearly',monthly=p_repeat='monthly',emoji=p_emoji,notify=p_notify,updated_at=now()
  where id=p_id and author_id=me returning id into rid;
  if rid is null then raise exception 'Puoi modificare solo le tue ricorrenze';end if;
 end if;
 return rid;
end $$;

-- Preserve the old RPC contract and monthly rows edited without the new control.
create or replace function public.save_anniversary(p_title text,p_first date,p_annual boolean,p_emoji text,p_notify boolean,p_id uuid default null)returns uuid
language plpgsql security definer set search_path=public as $$
begin
 if p_annual is null then raise exception 'Ripetizione non valida';end if;
 return public.save_anniversary_v2(p_title,p_first,
  case when p_annual then 'yearly' when exists(select 1 from public.anniversaries where id=p_id and monthly and author_id=public.my_profile_id())then 'monthly' else 'once' end,
  p_emoji,p_notify,p_id);
end $$;

create function public.anniversary_due(p_first date,p_annual boolean,p_monthly boolean,p_today date)returns boolean
language sql immutable set search_path=public as $$
 select p_first<=p_today and case when p_monthly then
  p_first<p_today and make_date(extract(year from p_today)::int,extract(month from p_today)::int,
   least(extract(day from p_first)::int,extract(day from(date_trunc('month',p_today::timestamp)+interval'1 month'-interval'1 day'))::int))=p_today
  when p_annual then public.anniversary_occurrence(p_first,extract(year from p_today)::int)=p_today
  else p_first=p_today end
$$;

create or replace function public.process_anniversary_jobs()returns void
language plpgsql security definer set search_path=public as $$
declare today date:=(now()at time zone'Europe/Rome')::date;a public.anniversaries;person record;claimed integer;
begin
 if (now()at time zone'Europe/Rome')::time<time'09:00'then return;end if;
 for a in select * from public.anniversaries where notify and public.anniversary_due(first_day,annual,monthly,today)loop
  insert into public.feature_job_runs(job,day)values('anniversary-'||a.id,today)on conflict do nothing;get diagnostics claimed=row_count;
  if claimed>0 then for person in select id from public.users loop
   perform public.queue_feature_notification(person.id,a.emoji||' Una giornata speciale','Oggi avete una ricorrenza da celebrare insieme.','anniversary','/ricorrenze');
  end loop;end if;
 end loop;
end $$;

revoke all on function public.save_anniversary_v2(text,date,text,text,boolean,uuid),public.anniversary_due(date,boolean,boolean,date)from public,anon,authenticated;
grant execute on function public.save_anniversary_v2(text,date,text,text,boolean,uuid)to authenticated;
grant execute on function public.anniversary_due(date,boolean,boolean,date)to authenticated,service_role;
commit;
