begin;
create table public.game_screen_presence(
 user_id uuid not null references public.users(id)on delete cascade,
 game text not null check(game in('tris','connect4','battleship','drawguess','wyr','daily','deeptalk')),
 session_id text not null check(length(session_id)between 1 and 80),
 active boolean not null,last_seen timestamptz not null,left_at timestamptz,
 primary key(user_id,game,session_id)
);
create table public.game_turn_waits(
 id uuid primary key default gen_random_uuid(),game text not null,context text not null,
 user_id uuid not null references public.users(id)on delete cascade,
 started_at timestamptz not null default clock_timestamp(),notified_at timestamptz,notification_id uuid,
 unique(game,context,user_id)
);
alter table public.game_screen_presence enable row level security;
alter table public.game_turn_waits enable row level security;
revoke all on public.game_screen_presence,public.game_turn_waits from public,anon,authenticated;
grant all on public.game_screen_presence,public.game_turn_waits to service_role;

create function public.game_is_present(p_user uuid,p_game text)returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.game_screen_presence where user_id=p_user and game=p_game and active and last_seen>clock_timestamp()-interval'90 seconds')
$$;
create function public.game_absent_since(p_user uuid,p_game text)returns timestamptz
language sql stable security definer set search_path=public as $$
 select max(case when active then last_seen+interval'90 seconds'else left_at end)
 from public.game_screen_presence where user_id=p_user and game=p_game
$$;

create function public.cancel_game_wait_notification()returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if old.notification_id is not null then
  delete from public.notification_inbox where id=old.notification_id and exists(select 1 from public.feature_notifications n where n.id=old.notification_id and n.delivered_at is null and not n.expo_done and not n.web_done);
  delete from public.feature_notifications where id=old.notification_id and delivered_at is null;
 end if;
 return old;
end $$;
create trigger cancel_game_wait before delete on public.game_turn_waits for each row execute function public.cancel_game_wait_notification();

create function public.update_game_presence(p_game text,p_session text,p_active boolean,p_profile uuid)returns void
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id();nid uuid;
begin
 if me is distinct from p_profile then raise exception 'Sessione cambiata';end if;
 if p_game is null or p_game not in('tris','connect4','battleship','drawguess','wyr','daily','deeptalk')or p_session is null or length(p_session)not between 1 and 80 or p_active is null then raise exception 'Presenza non valida';end if;
 perform pg_advisory_xact_lock(hashtextextended('game-presence:'||me||':'||p_game,0));
 insert into public.game_screen_presence(user_id,game,session_id,active,last_seen,left_at)
 values(me,p_game,p_session,p_active,clock_timestamp(),case when p_active then null else clock_timestamp()end)
 on conflict(user_id,game,session_id)do update set active=excluded.active,last_seen=excluded.last_seen,left_at=excluded.left_at;
 if p_active then
  -- Return before delivery cancels both the queued push and its inbox entry.
  for nid in select n.id from public.feature_notifications n join public.game_turn_waits w on w.notification_id=n.id
   where w.user_id=me and w.game=p_game and n.delivered_at is null and not n.expo_done and not n.web_done for update of w loop
   delete from public.notification_inbox where id=nid;
   update public.game_turn_waits set notification_id=null,notified_at=null where notification_id=nid;
   delete from public.feature_notifications where id=nid;
  end loop;
 end if;
end $$;

create function public.refresh_game_waits(p_game text,p_context text,p_actor uuid default null)returns void
language plpgsql security definer set search_path=public as $$
declare wanted uuid[]:='{}';m public.partner_games;t public.game_matches;person uuid;today date:=(now()at time zone'Europe/Rome')::date;
begin
 perform pg_advisory_xact_lock(hashtextextended('game-wait:'||p_game||':'||p_context,0));
 if p_game='tris' then
  select * into t from public.game_matches where id=p_context::uuid and game='tris'and status='playing'
   and id=(select id from public.game_matches where game='tris'order by created_at desc,id asc limit 1);
  if found then wanted:=array[t.turn];end if;
 elsif p_game in('connect4','battleship','drawguess')then
  select * into m from public.partner_games where id=p_context::uuid and game=p_game and status in('setup','playing');
  if found then
   if m.game='battleship'and m.status='setup'then
    if not coalesce((m.state->>'ready_a')::boolean,false)then wanted:=array_append(wanted,m.player_a);end if;
    if not coalesce((m.state->>'ready_b')::boolean,false)then wanted:=array_append(wanted,m.player_b);end if;
   elsif m.game='drawguess'then
    wanted:=array[case when jsonb_array_length(coalesce(m.state->'strokes','[]'::jsonb))=0 then(m.state->>'drawer')::uuid
     when(m.state->>'drawer')::uuid=m.player_a then m.player_b else m.player_a end];
   else wanted:=array[m.turn];end if;
  end if;
 elsif p_game='wyr'and p_context=today::text then
  select coalesce(array_agg(u.id),'{}')into wanted from public.users u
   where exists(select 1 from public.wyr_answers where day=today and user_id<>u.id)
   and not exists(select 1 from public.wyr_answers where day=today and user_id=u.id);
 elsif p_game='daily'and p_context=today::text then
  select coalesce(array_agg(u.id),'{}')into wanted from public.users u
   where exists(select 1 from public.daily_answers where day=today and user_id<>u.id)
   and not exists(select 1 from public.daily_answers where day=today and user_id=u.id);
 elsif p_game='deeptalk'and p_context=(date_trunc('week',today::timestamp)::date)::text then
  select coalesce(array_agg(u.id),'{}')into wanted from public.users u where exists(
   select 1 from public.deep_talk_marks a where a.week_start=p_context::date and a.user_id<>u.id and a.status='answered'
   and not exists(select 1 from public.deep_talk_marks b where b.week_start=a.week_start and b.q_index=a.q_index and b.user_id=u.id));
 end if;
 -- A real action by the waiting player restarts their inactivity interval.
 delete from public.game_turn_waits where game=p_game and context=p_context and(user_id<>all(wanted)or user_id=p_actor);
 foreach person in array wanted loop
  insert into public.game_turn_waits(game,context,user_id)values(p_game,p_context,person)on conflict(game,context,user_id)do nothing;
 end loop;
end $$;

create function public.sync_game_waits()returns trigger
language plpgsql security definer set search_path=public as $$
declare rowdata jsonb;kind text;ctx text;actor uuid;
begin
 rowdata:=case when tg_op='DELETE'then to_jsonb(old)else to_jsonb(new)end;
 select id into actor from public.users where auth_user_id=auth.uid();
 if tg_table_name='partner_games'then kind:=rowdata->>'game';ctx:=rowdata->>'id';
 elsif tg_table_name='game_matches'then kind:='tris';ctx:=rowdata->>'id';
 elsif tg_table_name='deep_talk_marks'then kind:='deeptalk';ctx:=rowdata->>'week_start';
 else kind:=case when tg_table_name='wyr_answers'then'wyr'else'daily'end;ctx:=rowdata->>'day';end if;
 perform public.refresh_game_waits(kind,ctx,actor);
 if tg_table_name='game_matches'then
  -- Starting a rematch invalidates any older abandoned turn.
  delete from public.game_turn_waits where game='tris'and context<>(select id::text from public.game_matches where game='tris'order by created_at desc,id asc limit 1);
 end if;
 return null;
end $$;
create trigger game_wait_partner after insert or update or delete on public.partner_games for each row execute function public.sync_game_waits();
create trigger game_wait_tris after insert or update or delete on public.game_matches for each row execute function public.sync_game_waits();
create trigger game_wait_wyr after insert or update or delete on public.wyr_answers for each row execute function public.sync_game_waits();
create trigger game_wait_daily after insert or update or delete on public.daily_answers for each row execute function public.sync_game_waits();
create trigger game_wait_deeptalk after insert or update or delete on public.deep_talk_marks for each row execute function public.sync_game_waits();

create function public.quiet_game_event(p_tag text,p_url text,p_body text)returns boolean
language sql immutable set search_path=public as $$
 select coalesce(p_tag in('partner-game','tris','wyr')or p_url~'^/(#/)?play/(tris|connect4|battleship|drawguess|wyr|daily)([/?#]|$)'
  or(p_tag='deeptalk'and p_body like 'Il partner ha risposto%'),false)
$$;

create function public.game_reminder_ready(p_notification uuid)returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.game_turn_waits w where w.notification_id=p_notification
  and not public.game_is_present(w.user_id,w.game)
  and greatest(w.started_at,coalesce(public.game_absent_since(w.user_id,w.game),w.started_at))<=clock_timestamp()-interval'10 minutes')
$$;
create function public.process_game_reminders()returns void
language plpgsql security definer set search_path=public as $$
declare w public.game_turn_waits;nid uuid;
begin
 if not pg_try_advisory_xact_lock(hashtext('pulse-game-reminders'))then return;end if;
 delete from public.game_turn_waits where(game in('wyr','daily')and context<>((now()at time zone'Europe/Rome')::date)::text)
  or(game='deeptalk'and context<>(date_trunc('week',now()at time zone'Europe/Rome')::date)::text);
 for w in select * from public.game_turn_waits where notified_at is null and started_at<=clock_timestamp()-interval'10 minutes'loop
  if not pg_try_advisory_xact_lock(hashtextextended('game-wait:'||w.game||':'||w.context,0))then continue;end if;
  if not pg_try_advisory_xact_lock(hashtextextended('game-presence:'||w.user_id||':'||w.game,0))then continue;end if;
  perform public.refresh_game_waits(w.game,w.context);
  select * into w from public.game_turn_waits where id=w.id and notified_at is null for update skip locked;
  if not found then continue;end if;
  if public.game_is_present(w.user_id,w.game)or greatest(w.started_at,coalesce(public.game_absent_since(w.user_id,w.game),w.started_at))>clock_timestamp()-interval'10 minutes'then continue;end if;
  insert into public.feature_notifications(user_id,title,body,tag,url)
   values(w.user_id,'🎮 Il partner ti aspetta',case when w.game in('wyr','daily','deeptalk')then'Hai una risposta in sospeso. Torniamo a giocare insieme?'else'Hai una mossa in sospeso. Torniamo a giocare insieme?'end,'game-reminder','/play/'||w.game)returning id into nid;
  update public.game_turn_waits set notification_id=nid,notified_at=clock_timestamp()where id=w.id;
 end loop;
 delete from public.game_screen_presence where last_seen<now()-interval'7 days';
end $$;

-- Function bodies for the existing queue/dispatcher/claim/scheduler are appended
-- below, preserving their original non-game behavior and execution grants.

-- Existing notification function overrides
CREATE OR REPLACE FUNCTION public.queue_feature_notification(p_user uuid, p_title text, p_body text, p_tag text, p_url text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare pending uuid; count integer; mergeable boolean;
begin
 if public.quiet_game_event(p_tag,p_url,p_body)then return;end if;
 if p_tag='deeptalk'and public.game_is_present(p_user,'deeptalk')then return;end if;
 if p_user is null then return; end if;
 -- Explicit event allowlist: invitations, results, confirmations and safety
 -- events cannot be merged just because they happen to share a tag or URL.
 mergeable:=coalesce(
  (p_tag='partner-game' and p_title='Il partner ha giocato') or
  (p_tag='tris' and p_title='⭕ Tris: tocca a te!') or
  (p_tag='fridge' and p_title='📝 Un nuovo post-it') or
  (p_tag='deeptalk' and p_body='Il partner ha risposto. Apri la carta per continuare.'),false);
 if mergeable then
  perform pg_advisory_xact_lock(hashtextextended('notification-batch:'||p_user||':'||p_tag||':'||p_url||':'||p_title,0));
  select id,aggregate_count into pending,count from public.feature_notifications
  where user_id=p_user and tag=p_tag and url=p_url and title=p_title
   and aggregate_kind=p_tag
   and delivered_at is null and attempts=0 and leased_until is null
   and not expo_done and not web_done
   and created_at>=clock_timestamp()-interval'30 seconds'
  order by created_at desc limit 1 for update;
  if pending is not null then
   count:=count+1;
   update public.feature_notifications set aggregate_count=count,
    body=case p_tag
     when 'fridge' then count||' nuovi post-it ti aspettano. Apri il frigo per leggerli.'
     when 'deeptalk' then 'Il partner ha risposto a '||count||' domande. Apri Deep Talk per continuare.'
     else count||' mosse del partner. Apri il gioco per continuare insieme.' end
    where id=pending;
   -- Preserve every individual event and its original preview in the inbox.
   insert into public.notification_inbox(user_id,title,body,tag,url)
    values(p_user,p_title,p_body,p_tag,p_url);
   return;
  end if;
 end if;
 -- The existing insert trigger archives the first event without duplication.
 insert into public.feature_notifications(user_id,title,body,tag,url,aggregate_kind)
 values(p_user,p_title,p_body,p_tag,p_url,case when mergeable then p_tag end);
end $function$
;
CREATE OR REPLACE FUNCTION public.notify_user(p_user_id uuid, p_title text, p_body text, p_tag text DEFAULT 'game'::text, p_url text DEFAULT '/'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_expo_token  text;
  v_web_sub     jsonb;
  v_req         bigint;
  v_push_secret text;
  v_supabase_url text := 'https://xptsgwcywxphledcafvs.supabase.co';
BEGIN
 if public.quiet_game_event(p_tag,p_url,p_body)then return;end if;
 if p_tag='deeptalk'and public.game_is_present(p_user_id,'deeptalk')then return;end if;
  -- Only repetitive Tris turns use the queue; invitations/results keep the
  -- existing immediate native/web delivery path.
  IF p_tag = 'tris' AND p_title = '⭕ Tris: tocca a te!' THEN
    PERFORM public.queue_feature_notification(p_user_id,p_title,p_body,p_tag,p_url);
    RETURN;
  END IF;
  SELECT expo_push_token, web_push_subscription
    INTO v_expo_token, v_web_sub
    FROM public.users
   WHERE id = p_user_id;

  IF v_expo_token IS NOT NULL AND v_expo_token <> '' THEN
    v_req := net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
      body := jsonb_build_object(
        'to', v_expo_token,
        'sound', 'default',
        'title', p_title,
        'body', p_body,
        'channelId', 'pulse_alerts',
        'priority', 'high',
        'data', jsonb_build_object('type', p_tag, 'url', p_url)
      )
    );
    INSERT INTO public.expo_push_outbox (user_id, token, send_request_id)
    VALUES (p_user_id, v_expo_token, v_req);
  END IF;

  IF v_web_sub IS NOT NULL AND v_web_sub <> 'null'::jsonb THEN
    SELECT decrypted_secret INTO v_push_secret
      FROM vault.decrypted_secrets
     WHERE name = 'push_secret'
     LIMIT 1;

    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/send-web-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-secret', COALESCE(v_push_secret, '')
      ),
      body := jsonb_build_object(
        'subscription', v_web_sub,
        'title', p_title,
        'body', p_body,
        'url', p_url,
        'tag', p_tag
      )
    );
  END IF;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.claim_feature_notifications()
 RETURNS TABLE(id uuid, user_id uuid, title text, body text, tag text, url text, expo_token text, web_subscription jsonb, expo_done boolean, web_done boolean, attempts integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 with selected as(select n.id from public.feature_notifications n where delivered_at is null and(n.tag<>'game-reminder'or public.game_reminder_ready(n.id)) and attempts<5 and coalesce(leased_until,'2000-01-01')<now()order by (tag like 'checkin%')desc,created_at limit 10 for update skip locked),claimed as(update public.feature_notifications n set leased_until=now()+interval'2 minutes',attempts=attempts+1 from selected s where n.id=s.id returning n.*)
 select c.id,c.user_id,c.title,c.body,c.tag,c.url,u.expo_push_token,u.web_push_subscription,c.expo_done,c.web_done,c.attempts from claimed c join public.users u on u.id=c.user_id
$function$
;
CREATE OR REPLACE FUNCTION public.process_feature_jobs()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
 if not pg_try_advisory_xact_lock(hashtext('pulse-relationship-jobs'))then return;end if;
 perform public.process_feature_jobs_core();perform public.process_reminder_jobs();perform public.process_remote_date_jobs();perform public.process_anniversary_jobs();perform public.process_game_reminders();
 delete from public.emotional_states where expires_at<=now();delete from public.care_requests where expires_at<=now();
end $function$
;
revoke all on function public.update_game_presence(text,text,boolean,uuid),public.game_is_present(uuid,text),public.game_absent_since(uuid,text),public.cancel_game_wait_notification(),public.refresh_game_waits(text,text,uuid),public.sync_game_waits(),public.quiet_game_event(text,text,text),public.game_reminder_ready(uuid),public.process_game_reminders()from public,anon,authenticated;
grant execute on function public.update_game_presence(text,text,boolean,uuid)to authenticated;
grant execute on function public.game_reminder_ready(uuid),public.process_game_reminders()to service_role;

-- Cancel only unsent obsolete game events; preserve delivered history.
delete from public.notification_inbox i using public.feature_notifications n where i.id=n.id and n.delivered_at is null and public.quiet_game_event(n.tag,n.url,n.body);
delete from public.feature_notifications n where n.delivered_at is null and public.quiet_game_event(n.tag,n.url,n.body);
do $$ declare r record;begin
 for r in select game,id::text context from public.partner_games where status in('setup','playing')
  union all select 'tris',id::text from public.game_matches where game='tris'and status='playing'order by 1,2 loop
  perform public.refresh_game_waits(r.game,r.context);end loop;
 perform public.refresh_game_waits('wyr',((now()at time zone'Europe/Rome')::date)::text);
 perform public.refresh_game_waits('daily',((now()at time zone'Europe/Rome')::date)::text);
 perform public.refresh_game_waits('deeptalk',(date_trunc('week',now()at time zone'Europe/Rome')::date)::text);
end $$;
commit;

