begin;
create table public.care_requests (
 id uuid primary key references public.users(id) on delete cascade,
 need text check(need in('talk','message','distraction','space','hug')),
 note text not null default '' check(length(note)<=140),
 expires_at timestamptz not null, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.care_requests enable row level security;
create policy care_read on public.care_requests for select to authenticated using(public.is_couple_member());
grant select on public.care_requests to authenticated;
create function public.set_care_request(p_need text,p_note text default '',p_minutes integer default 120)returns void
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id(); old public.care_requests;
begin
 if p_need is not null and p_need not in('talk','message','distraction','space','hug') then raise exception 'Attenzione non valida';end if;
 if p_minutes is null or p_minutes not between 15 and 1440 or length(coalesce(p_note,''))>140 then raise exception 'Durata o messaggio non valido';end if;
 perform pg_advisory_xact_lock(hashtext('care-'||me::text));
 select * into old from public.care_requests where id=me;
 insert into public.care_requests(id,need,note,expires_at)values(me,p_need,btrim(coalesce(p_note,'')),now()+make_interval(mins=>p_minutes))
 on conflict(id)do update set need=excluded.need,note=excluded.note,expires_at=excluded.expires_at,updated_at=now();
 if p_need is not null and (old.updated_at is null or old.updated_at<now()-interval'15 minutes') then
 perform public.queue_feature_notification(public.partner_profile_id(),'🫂 Un piccolo gesto','Il partner ti ha detto come puoi stargli vicino.','care','/vicinanza');end if;
end $$;
revoke all on function public.set_care_request(text,text,integer)from public,anon;
grant execute on function public.set_care_request(text,text,integer)to authenticated;
alter publication supabase_realtime add table public.care_requests;
commit;
