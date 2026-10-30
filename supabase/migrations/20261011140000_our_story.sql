begin;
create table public.story_moments (
 id uuid primary key default gen_random_uuid(),author_id uuid not null references public.users(id),
 title text not null check(length(btrim(title))between 1 and 80),day date not null,
 body text not null default ''check(length(body)<=600),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.story_moments enable row level security;
create policy story_read on public.story_moments for select to authenticated using(public.is_couple_member());
grant select on public.story_moments to authenticated;
create function public.save_story_moment(p_title text,p_day date,p_body text,p_id uuid default null)returns uuid
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id(); rid uuid;
begin
 if p_day is null or p_day> (now()at time zone'Europe/Rome')::date or p_day<date'1900-01-01'then raise exception 'Scegli una data passata o di oggi';end if;
 if p_id is null then insert into public.story_moments(author_id,title,day,body)values(me,btrim(p_title),p_day,btrim(coalesce(p_body,'')))returning id into rid;
 else update public.story_moments set title=btrim(p_title),day=p_day,body=btrim(coalesce(p_body,'')),updated_at=now()where id=p_id and author_id=me returning id into rid;
 if rid is null then raise exception 'Puoi modificare solo i tuoi momenti';end if;end if;
 return rid;
end $$;
create function public.delete_story_moment(p_id uuid)returns void
language plpgsql security definer set search_path=public as $$
begin delete from public.story_moments where id=p_id and author_id=public.my_profile_id();if not found then raise exception 'Puoi eliminare solo i tuoi momenti';end if;end $$;
revoke all on function public.save_story_moment(text,date,text,uuid),public.delete_story_moment(uuid)from public,anon;
grant execute on function public.save_story_moment(text,date,text,uuid),public.delete_story_moment(uuid)to authenticated;
alter publication supabase_realtime add table public.story_moments;
commit;
