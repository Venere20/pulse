begin;
-- Public change counters contain no answers. They let new clients identify
-- outdated snapshots, including deletions that revoke partner visibility.
create table public.deep_talk_versions (
 week_start date primary key, revision integer not null default 0 check(revision>=0)
);
alter table public.deep_talk_versions enable row level security;
revoke all on public.deep_talk_versions from public,anon,authenticated;
grant select on public.deep_talk_versions to authenticated;
create policy versions_read on public.deep_talk_versions for select to authenticated using(public.is_couple_member());
insert into public.deep_talk_versions(week_start) select distinct week_start from public.deep_talk_marks;

create function public.bump_deep_talk_version() returns trigger
language plpgsql security definer set search_path=public as $$
declare changed_week date;
begin
 changed_week:=case when tg_op='DELETE' then old.week_start else new.week_start end;
 insert into public.deep_talk_versions(week_start,revision) values(changed_week,1)
 on conflict(week_start) do update set revision=deep_talk_versions.revision+1;
 return null;
end $$;
revoke all on function public.bump_deep_talk_version() from public,anon,authenticated;
create trigger deep_talk_marks_version after insert or update or delete on public.deep_talk_marks for each row execute function public.bump_deep_talk_version();
create trigger deep_talk_answers_version after insert or update or delete on public.deep_talk_answers for each row execute function public.bump_deep_talk_version();
alter publication supabase_realtime add table public.deep_talk_versions;

-- SECURITY INVOKER is intentional: the existing RLS decides which answers may
-- be returned. The public metadata history and selected week's private answers
-- are read in one snapshot, together with its version.
create function public.deep_talk_snapshot(p_week date) returns jsonb
language plpgsql stable security invoker set search_path=public as $$
declare result jsonb;
begin
 perform public.my_profile_id();
 if p_week is null or extract(isodow from p_week)<>1 then raise exception 'Settimana non valida'; end if;
 select jsonb_build_object(
  'week_start',p_week,
  'revision',coalesce((select revision from public.deep_talk_versions where week_start=p_week),0),
  'marks',coalesce((select jsonb_agg(to_jsonb(m) order by m.week_start desc,m.q_index,m.user_id) from public.deep_talk_marks m),'[]'::jsonb),
  'answers',coalesce((select jsonb_agg(to_jsonb(a) order by a.q_index,a.user_id) from public.deep_talk_answers a where a.week_start=p_week),'[]'::jsonb)
 ) into result;
 return result;
end $$;

-- Preserve the original void RPC for installed clients. New clients receive
-- the permitted snapshot in the same transaction as their confirmed action.
create function public.deep_talk_action_state(p_week date,p_q smallint,p_deck text,p_action text,p_body text default null) returns jsonb
language plpgsql security invoker set search_path=public as $$
begin
 perform public.deep_talk_action(p_week,p_q,p_deck,p_action,p_body);
 return public.deep_talk_snapshot(p_week);
end $$;
revoke all on function public.deep_talk_snapshot(date),public.deep_talk_action_state(date,smallint,text,text,text) from public,anon;
grant execute on function public.deep_talk_snapshot(date),public.deep_talk_action_state(date,smallint,text,text,text) to authenticated;
commit;
