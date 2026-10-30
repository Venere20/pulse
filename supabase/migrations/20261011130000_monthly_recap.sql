begin;
create table public.monthly_reflections (
 id uuid primary key default gen_random_uuid(),author_id uuid not null references public.users(id),
 month date not null check(extract(day from month)=1),body text not null check(length(btrim(body))between 1 and 600),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(author_id,month)
);
alter table public.monthly_reflections enable row level security;
create policy reflections_read on public.monthly_reflections for select to authenticated using(public.is_couple_member());
grant select on public.monthly_reflections to authenticated;
create function public.save_monthly_reflection(p_month date,p_body text)returns void
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id(); today date:=(now()at time zone'Europe/Rome')::date;
begin
 if p_month is null or extract(day from p_month)<>1 or p_month>today or p_month<date'2000-01-01'then raise exception 'Mese non valido';end if;
 if nullif(btrim(p_body),'')is null then delete from public.monthly_reflections where author_id=me and month=p_month;return;end if;
 insert into public.monthly_reflections(author_id,month,body)values(me,p_month,btrim(p_body))on conflict(author_id,month)do update set body=excluded.body,updated_at=now();
end $$;
revoke all on function public.save_monthly_reflection(date,text)from public,anon;
grant execute on function public.save_monthly_reflection(date,text)to authenticated;
alter table public.bucket_list add column completed_at timestamptz;
create function public.stamp_bucket_completion()returns trigger language plpgsql set search_path=public as $$
begin
 if not new.is_completed then new.completed_at:=null;
 elsif tg_op='INSERT'then new.completed_at:=now();
 elsif not old.is_completed then new.completed_at:=now();else new.completed_at:=old.completed_at;end if;
 return new;
end $$;
create trigger bucket_completion before insert or update on public.bucket_list for each row execute function public.stamp_bucket_completion();
alter publication supabase_realtime add table public.monthly_reflections;
commit;
