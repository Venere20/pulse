begin;
alter table public.feature_notifications add column aggregate_count integer not null default 1;
alter table public.feature_notifications add column aggregate_kind text;

create or replace function public.queue_feature_notification(p_user uuid,p_title text,p_body text,p_tag text,p_url text) returns void
language plpgsql security definer set search_path=public as $$
declare pending uuid; count integer; mergeable boolean;
begin
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
end $$;
revoke all on function public.queue_feature_notification(uuid,text,text,text,text) from public,anon,authenticated;
CREATE OR REPLACE FUNCTION public.notify_user(
  p_user_id uuid,
  p_title   text,
  p_body    text,
  p_tag     text DEFAULT 'game',
  p_url     text DEFAULT '/'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_expo_token  text;
  v_web_sub     jsonb;
  v_req         bigint;
  v_push_secret text;
  v_supabase_url text := 'https://xptsgwcywxphledcafvs.supabase.co';
BEGIN
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
$fn$;
REVOKE ALL ON FUNCTION public.notify_user(uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
commit;
