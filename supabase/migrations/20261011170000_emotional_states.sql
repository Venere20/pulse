begin;
create table public.emotional_states (
 id uuid primary key references public.users(id)on delete cascade,
 mood text not null check(mood in('happy','calm','tired','sad','anxious','overwhelmed','loved','lonely','excited')),
 note text not null default ''check(length(note)<=140),expires_at timestamptz not null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),notified_at timestamptz
);
alter table public.emotional_states enable row level security;
create policy emotion_read on public.emotional_states for select to authenticated using(public.is_couple_member()and expires_at>now());
grant select on public.emotional_states to authenticated;
create function public.set_my_emotion(p_mood text,p_note text default '',p_minutes integer default 120,p_notify boolean default false)returns void
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id(); last_notified timestamptz;
begin
 perform pg_advisory_xact_lock(hashtext('emotion-'||me::text));
 if p_mood is null then delete from public.emotional_states where id=me;return;end if;
 if p_minutes is null or p_minutes not between 15 and 1440 then raise exception 'Durata non valida';end if;
 select notified_at into last_notified from public.emotional_states where id=me;
 insert into public.emotional_states(id,mood,note,expires_at)values(me,p_mood,btrim(coalesce(p_note,'')),now()+make_interval(mins=>p_minutes))
 on conflict(id)do update set mood=excluded.mood,note=excluded.note,expires_at=excluded.expires_at,updated_at=now();
 if p_notify and(last_notified is null or last_notified<now()-interval'15 minutes')then
 perform public.queue_feature_notification(public.partner_profile_id(),'💭 Come mi sento','Il partner ha condiviso il suo umore con te.','emotion','/umore');
 update public.emotional_states set notified_at=now()where id=me;end if;
end $$;
create or replace function public.process_feature_jobs()returns void
language plpgsql security definer set search_path=public as $$
begin
 if not pg_try_advisory_xact_lock(hashtext('pulse-relationship-jobs'))then return;end if;
 perform public.process_feature_jobs_core();perform public.process_reminder_jobs();perform public.process_remote_date_jobs();perform public.process_anniversary_jobs();
 delete from public.emotional_states where expires_at<=now();delete from public.care_requests where expires_at<=now();
end $$;
-- Signature includes notification preference.
revoke all on function public.set_my_emotion(text,text,integer,boolean)from public,anon;
grant execute on function public.set_my_emotion(text,text,integer,boolean)to authenticated;
alter publication supabase_realtime add table public.emotional_states;
commit;
