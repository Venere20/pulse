begin;
create table public.notification_inbox (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.users(id)on delete cascade,
 title text not null,body text not null,tag text not null,url text not null,
 created_at timestamptz not null default now(),read_at timestamptz
);
create index notification_inbox_owner_time on public.notification_inbox(user_id,created_at desc,id desc);
alter table public.notification_inbox enable row level security;
create policy inbox_read on public.notification_inbox for select to authenticated using(case when public.is_couple_member()then user_id=public.my_profile_id()else false end);
grant select on public.notification_inbox to authenticated;
grant all on public.notification_inbox to service_role;
create function public.archive_feature_notification()returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.notification_inbox(id,user_id,title,body,tag,url,created_at)values(new.id,new.user_id,new.title,new.body,new.tag,new.url,new.created_at)on conflict(id)do nothing;return new;end $$;
revoke all on function public.archive_feature_notification()from public,anon,authenticated;
create trigger notification_archive after insert on public.feature_notifications for each row execute function public.archive_feature_notification();
insert into public.notification_inbox(id,user_id,title,body,tag,url,created_at)select id,user_id,title,body,tag,url,created_at from public.feature_notifications on conflict(id)do nothing;
create function public.archive_pulse_notification()returns trigger language plpgsql security definer set search_path=public as $$
declare recipient uuid;
begin
 select id into recipient from public.users where id<>new.sender_id order by id limit 1;
 if recipient is not null then insert into public.notification_inbox(user_id,title,body,tag,url,created_at)values(recipient,'❤️ Un Pulse per te',coalesce(nullif(btrim(new.message),''),'Il partner ti sta pensando.'),'pulse','/',new.created_at);end if;
 return new;
end $$;
revoke all on function public.archive_pulse_notification()from public,anon,authenticated;
create trigger pulse_archive after insert on public.pulse_logs for each row execute function public.archive_pulse_notification();
create function public.read_my_notifications(p_id uuid default null,p_before timestamptz default null)returns void language plpgsql security definer set search_path=public as $$
begin update public.notification_inbox set read_at=now()where user_id=public.my_profile_id()and read_at is null and(p_id is null or id=p_id)and created_at<=coalesce(p_before,now());end $$;
revoke all on function public.read_my_notifications(uuid,timestamptz)from public,anon;
grant execute on function public.read_my_notifications(uuid,timestamptz)to authenticated;
alter publication supabase_realtime add table public.notification_inbox;
commit;
