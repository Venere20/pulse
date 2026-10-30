begin;
create table public.bucket_preferences (
 id uuid primary key default gen_random_uuid(),bucket_item_id uuid not null references public.bucket_list(id)on delete cascade,
 user_id uuid not null references public.users(id),vote text not null check(vote in('yes','maybe','no')),
 created_at timestamptz not null default now(),unique(bucket_item_id,user_id)
);
create table public.bucket_details (
 id uuid primary key references public.bucket_list(id)on delete cascade,
 estimated_budget numeric check(estimated_budget between 0 and 100000),estimated_minutes integer check(estimated_minutes between 5 and 43200),
 created_at timestamptz not null default now()
);
alter table public.bucket_preferences enable row level security;alter table public.bucket_details enable row level security;
create policy bucket_preferences_read on public.bucket_preferences for select to authenticated using(public.is_couple_member());
create policy bucket_details_read on public.bucket_details for select to authenticated using(public.is_couple_member());
grant select on public.bucket_preferences,public.bucket_details to authenticated;
create function public.set_bucket_preference(p_id uuid,p_vote text)returns void
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id();
begin
 if p_vote is null then delete from public.bucket_preferences where bucket_item_id=p_id and user_id=me;
 else insert into public.bucket_preferences(bucket_item_id,user_id,vote)values(p_id,me,p_vote)on conflict(bucket_item_id,user_id)do update set vote=excluded.vote;end if;
end $$;
create function public.set_bucket_details(p_id uuid,p_budget numeric,p_minutes integer)returns void
language plpgsql security definer set search_path=public as $$
begin
 perform public.my_profile_id();
 insert into public.bucket_details(id,estimated_budget,estimated_minutes)values(p_id,p_budget,p_minutes)on conflict(id)do update set estimated_budget=excluded.estimated_budget,estimated_minutes=excluded.estimated_minutes;
end $$;
alter table public.date_proposals add column bucket_item_id uuid references public.bucket_list(id)on delete set null;
create function public.create_bucket_proposal(p_bucket uuid,p_title text,p_place text,p_note text,p_options jsonb)returns uuid
language plpgsql security definer set search_path=public as $$
declare rid uuid;
begin
 perform public.my_profile_id();
 if not exists(select 1 from public.bucket_list where id=p_bucket and not is_completed)then raise exception 'Desiderio non disponibile';end if;
 rid:=public.create_date_proposal(p_title,p_place,p_note,p_options);
 update public.date_proposals set bucket_item_id=p_bucket where id=rid;return rid;
end $$;
create function public.link_proposal_wish()returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.status='confirmed'and new.visit_id is not null and new.bucket_item_id is not null then
 insert into public.visit_bucket_items(visit_id,bucket_item_id)values(new.visit_id,new.bucket_item_id)on conflict do nothing;end if;return new;
end $$;
create trigger proposal_wish after update on public.date_proposals for each row execute function public.link_proposal_wish();
revoke all on function public.set_bucket_preference(uuid,text),public.set_bucket_details(uuid,numeric,integer),public.create_bucket_proposal(uuid,text,text,text,jsonb)from public,anon;
grant execute on function public.set_bucket_preference(uuid,text),public.set_bucket_details(uuid,numeric,integer),public.create_bucket_proposal(uuid,text,text,text,jsonb)to authenticated;
alter publication supabase_realtime add table public.bucket_preferences,public.bucket_details;
commit;
