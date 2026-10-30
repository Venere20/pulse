begin;
alter table public.feature_notifications add column leased_until timestamptz;
alter table public.feature_notifications add column delivered_at timestamptz;
alter table public.feature_notifications add column expo_done boolean not null default false;
alter table public.feature_notifications add column web_done boolean not null default false;
create table public.feature_job_runs(job text not null,day date not null,primary key(job,day));
alter table public.feature_job_runs enable row level security;
revoke all on public.feature_job_runs from anon,authenticated;
create table public.feature_push_receipts(ticket_id text primary key,user_id uuid not null references public.users(id),token text not null,created_at timestamptz not null default now(),checked_at timestamptz,error text);
alter table public.feature_push_receipts enable row level security;
revoke all on public.feature_push_receipts from anon,authenticated;

create or replace function public.register_my_push(p_kind text,p_token text default null,p_subscription jsonb default null)returns void
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id();
begin
 if p_kind='native' then
  if p_token is not null and (length(p_token)>250 or p_token!~'^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$')then raise exception 'Token non valido';end if;
  perform pg_advisory_xact_lock(hashtext('push-token-'||coalesce(p_token,me::text)));
  if p_token is not null then update public.users set expo_push_token=null where expo_push_token=p_token and id<>me;end if;
  update public.users set expo_push_token=p_token where id=me;
 elsif p_kind='web' then
  if p_subscription is not null and (jsonb_typeof(p_subscription)<>'object' or coalesce(p_subscription->>'endpoint','')!~'^https://' or octet_length(p_subscription::text)>8192)then raise exception 'Sottoscrizione non valida';end if;
  if p_subscription is not null then update public.users set web_push_subscription=null where web_push_subscription->>'endpoint'=p_subscription->>'endpoint' and id<>me;end if;
  update public.users set web_push_subscription=p_subscription where id=me;
 else raise exception 'Piattaforma non valida';end if;
end $$;
revoke update(expo_push_token,web_push_subscription)on public.users from authenticated;
revoke all on function public.register_my_push(text,text,jsonb)from public,anon;
grant execute on function public.register_my_push(text,text,jsonb)to authenticated;

create or replace function public.process_feature_jobs()returns void
language plpgsql security definer set search_path=public as $$
declare c public.safe_checkins; capsule public.time_capsules; proposal public.date_proposals; packing record; person record; today date:=(now()at time zone'Europe/Rome')::date; localtime time:=(now()at time zone'Europe/Rome')::time; vid uuid; job text; claimed integer;
begin
 -- A single scheduler transaction prevents duplicate messages at simultaneous ticks.
 if not pg_try_advisory_xact_lock(hashtext('pulse-feature-jobs')) then return;end if;
 update public.users set current_status=null,status_expires_at=null where status_expires_at<=now();
 for c in select * from public.safe_checkins where status in('active','alerted') for update skip locked loop
  if c.status='alerted' and c.alerted_at+interval'6 hours'<=now()then
   update public.safe_checkins set status='expired',closed_at=now()where id=c.id;insert into public.checkin_events(checkin_id,kind)values(c.id,'expired');
  elsif c.status='active' and c.due_at+make_interval(mins=>c.grace_minutes)<=now()then
   update public.safe_checkins set status='alerted',alerted_at=now(),prompted_at=coalesce(prompted_at,now())where id=c.id;
   insert into public.checkin_events(checkin_id,kind)values(c.id,'alerted');
   perform public.queue_feature_notification((select id from public.users where id<>c.user_id order by id limit 1),'⚠️ Arrivo non confermato','Il partner non ha confermato l’arrivo. Prova a contattarlo.','checkin-alert','/checkin');
  elsif c.status='active' and c.due_at<=now()and c.prompted_at is null then
   update public.safe_checkins set prompted_at=now()where id=c.id;
   perform public.queue_feature_notification(c.user_id,'🛡️ Sei arrivato/a?','Conferma il check-in per avvisare il partner.','checkin','/checkin');
  elsif c.status='alerted' and c.alerted_at+interval'15 minutes'<=now()and c.second_alert_at is null then
   update public.safe_checkins set second_alert_at=now()where id=c.id;
   for person in select id from public.users loop perform public.queue_feature_notification(person.id,'⚠️ Check-in ancora aperto','L’arrivo non è ancora stato confermato. Contattatevi direttamente.','checkin-alert','/checkin');end loop;
  end if;
 end loop;
 for proposal in select * from public.date_proposals where status='open'for update skip locked loop
  if not exists(select 1 from public.date_options where proposal_id=proposal.id and withdrawn_at is null and start_date>=today)then
   update public.date_proposals set status='expired',updated_at=now()where id=proposal.id;
  elsif proposal.nudged_at is null and proposal.created_at+interval'48 hours'<=now()then
   update public.date_proposals set nudged_at=now()where id=proposal.id;
   perform public.queue_feature_notification((select id from public.users where id<>proposal.created_by order by id limit 1),'📅 Scegliamo le date?','Una proposta aperta ti aspetta.','proposal','/proposte/'||proposal.id);
  end if;
 end loop;
 for capsule in select * from public.time_capsules where status in('draft','sealed')for update skip locked loop
  if capsule.status='draft' and capsule.created_at+interval'24 hours'<=now()then
   insert into public.capsule_cleanup(path)select name from storage.objects where bucket_id='capsules'and name like capsule.id||'/%'on conflict do nothing;
   delete from public.time_capsules where id=capsule.id;
  elsif capsule.status='sealed' then
   if capsule.unlock_kind='visit'and capsule.visit_id is null then
    update public.time_capsules set unlock_kind='next_visit',updated_at=now()where id=capsule.id;
    perform public.queue_feature_notification(capsule.author_id,'💌 Incontro eliminato','La capsula si aprirà al prossimo incontro.','capsule','/capsule');
   end if;
   if capsule.unlock_kind='next_visit'and capsule.visit_id is null then
    select id into vid from public.visits where public.visit_start_at(id)>capsule.updated_at and coalesce(status,'planned')<>'concluded'order by start_date limit 1;
    if vid is not null then update public.time_capsules set visit_id=vid where id=capsule.id;end if;
   end if;
  end if;
 end loop;
 -- Cron has no auth.uid(): evaluate due dates under its privileged role.
 for capsule in select * from public.time_capsules where status='sealed'and((unlock_kind='date'and unlock_at<=now())or(unlock_kind in('visit','next_visit')and visit_id is not null and public.visit_start_at(visit_id)<=now()))for update skip locked loop
  update public.time_capsules set status='open',opened_at=now(),updated_at=now()where id=capsule.id;
  perform public.queue_feature_notification(capsule.recipient_id,'💌 Una capsula si è aperta','Scopri la sorpresa che il partner ti ha lasciato.','capsule','/capsule');
 end loop;
 if localtime>=time'18:00'then
  for packing in select l.id,l.owner_id,v.id visit_id from public.packing_lists l join public.visits v on v.id=l.visit_id join public.packing_progress p on p.visit_id=l.visit_id and p.owner_id=l.owner_id where l.reminded_at is null and(v.start_date at time zone'UTC')::date=today+1 and p.checked<p.total for update of l skip locked loop
   update public.packing_lists set reminded_at=now()where id=packing.id;
   perform public.queue_feature_notification(packing.owner_id,'🧳 Domani si parte','Ci sono ancora oggetti da preparare nella tua valigia.','packing','/visit/'||packing.visit_id||'?tab=packing');
  end loop;
 end if;
 if localtime>=time'09:00'and extract(isodow from today)in(1,6)then
  job:=case when extract(isodow from today)=1 then'deep-talk-week'else'deep-talk-reminder'end;
  insert into public.feature_job_runs(job,day)values(job,today)on conflict do nothing;get diagnostics claimed=row_count;
  if claimed>0 then
   for person in select id from public.users loop
    if job='deep-talk-week' or (exists(select 1 from public.deep_talk_marks where week_start=today-5 and user_id<>person.id and status='answered')and(select count(*)from public.deep_talk_marks where week_start=today-5 and user_id=person.id and status='answered')<3)then
     perform public.queue_feature_notification(person.id,'🗝️ Deep Talk',case when job='deep-talk-week'then'È arrivata la nuova carta della settimana.'else'Il partner ti aspetta: ci sono domande in sospeso.'end,'deeptalk','/play/deeptalk');
    end if;
   end loop;
  end if;
 end if;
 delete from public.fridge_notes where removed_at<now()-interval'7 days'or(done_at<now()-interval'14 days'and removed_at is null);
 delete from public.checkin_events where created_at<now()-interval'30 days';
 delete from public.safe_checkins where closed_at<now()-interval'30 days';
 delete from public.packing_lists l using public.visits v where v.id=l.visit_id and(v.end_date at time zone'UTC')::date<today-30;
 delete from public.feature_notifications where created_at<now()-interval'30 days';
 delete from public.feature_push_receipts where created_at<now()-interval'3 days';
 -- Remove abandoned uploads without touching photos reserved by a live capsule.
 insert into public.capsule_cleanup(path)
 select o.name from storage.objects o where o.bucket_id='capsules'and o.created_at<now()-interval'24 hours'
 and not exists(select 1 from public.capsule_contents content where o.name=any(content.photo_paths))
 on conflict do nothing;
 insert into public.feature_heartbeat(id,checked_at)values(true,now())on conflict(id)do update set checked_at=now();
end $$;
create or replace function public.claim_feature_notifications()returns table(id uuid,user_id uuid,title text,body text,tag text,url text,expo_token text,web_subscription jsonb,expo_done boolean,web_done boolean,attempts integer)
language sql security definer set search_path=public as $$
 with selected as(select n.id from public.feature_notifications n where delivered_at is null and attempts<5 and coalesce(leased_until,'2000-01-01')<now()order by (tag like 'checkin%')desc,created_at limit 10 for update skip locked),claimed as(update public.feature_notifications n set leased_until=now()+interval'2 minutes',attempts=attempts+1 from selected s where n.id=s.id returning n.*)
 select c.id,c.user_id,c.title,c.body,c.tag,c.url,u.expo_push_token,u.web_push_subscription,c.expo_done,c.web_done,c.attempts from claimed c join public.users u on u.id=c.user_id
$$;
revoke all on function public.process_feature_jobs(),public.claim_feature_notifications()from public,anon,authenticated;
grant execute on function public.process_feature_jobs(),public.claim_feature_notifications()to service_role;
grant all on public.feature_notifications,public.feature_push_receipts,public.feature_heartbeat,public.capsule_cleanup to service_role;
grant insert on public.checkin_events to service_role;

-- One protected worker drives processing, delivery retries and photo cleanup.
-- Deploy feature-worker before applying this migration. Vault already contains push_secret.
select cron.schedule('pulse-feature-worker','* * * * *',$job$
 select net.http_post(url:='https://xptsgwcywxphledcafvs.supabase.co/functions/v1/feature-worker',headers:=jsonb_build_object('Content-Type','application/json','x-push-secret',(select decrypted_secret from vault.decrypted_secrets where name='push_secret'limit 1)),body:='{}'::jsonb);
$job$);
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

