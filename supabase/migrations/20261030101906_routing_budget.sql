begin;
create table public.routing_budget(id boolean primary key default true check(id),day date not null,requests integer not null default 0 check(requests between 0 and 120),last_at timestamptz);
alter table public.routing_budget enable row level security;
revoke all on public.routing_budget from public,anon,authenticated;
insert into public.routing_budget(id,day) values(true,(now() at time zone 'Europe/Rome')::date);
create function public.claim_routing_request() returns boolean language plpgsql security definer set search_path=public as $$
declare b public.routing_budget;today date:=(now() at time zone 'Europe/Rome')::date;
begin
 if public.my_profile_id() is null or not public.is_couple_member() then raise exception 'Accesso non consentito';end if;
 select * into b from public.routing_budget where id=true for update;
 if b.last_at>clock_timestamp()-interval '1 second' then return false;end if;
 if b.day=today and b.requests>=120 then return false;end if;
 update public.routing_budget set day=today,requests=case when day=today then requests+1 else 1 end,last_at=clock_timestamp() where id=true;
 return true;
end $$;
revoke all on function public.claim_routing_request() from public,anon;
grant execute on function public.claim_routing_request() to authenticated;
commit;
