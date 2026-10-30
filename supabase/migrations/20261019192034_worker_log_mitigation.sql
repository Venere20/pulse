begin;
-- Internal technical history only: never delete pulse_logs or notification_inbox.
create or replace function public.prune_feature_technical_history() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare runs integer; failures integer; notices integer; receipts integer; outbox integer; dedup integer;
begin
 delete from cron.job_run_details where status='succeeded' and end_time < now()-interval '1 day';
 get diagnostics runs = row_count;
 delete from cron.job_run_details where status='failed' and end_time < now()-interval '30 days';
 get diagnostics failures = row_count;
 delete from public.feature_notifications where delivered_at < now()-interval '7 days';
 get diagnostics notices = row_count;
 delete from public.feature_push_receipts where checked_at < now()-interval '1 day' and error is null;
 get diagnostics receipts = row_count;
 delete from public.expo_push_outbox where status='done' and created_at < now()-interval '1 day';
 get diagnostics outbox = row_count;
 delete from public.feature_job_runs where day < (now() at time zone 'Europe/Rome')::date-90;
 get diagnostics dedup = row_count;
 return jsonb_build_object('cron_success',runs,'cron_failure_expired',failures,
 'delivered_notifications',notices,'successful_receipts',receipts,'finished_outbox',outbox,'expired_job_marks',dedup);
end $$;
revoke all on function public.prune_feature_technical_history() from public,anon,authenticated,service_role;

-- Service role only, with the existing shared-secret check retained.
create or replace function public.feature_worker_batch(p_secret text,p_mode text default 'dispatch') returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare jobs jsonb; receipts jsonb; cleanup jsonb; heartbeat timestamptz;
begin
 if public.verify_push_secret(p_secret) is distinct from true then
  return jsonb_build_object('authorized',false);
 end if;
 if p_mode = 'health' then
  select checked_at into heartbeat from public.feature_heartbeat where id=true;
  return jsonb_build_object('authorized',true,'checked_at',heartbeat);
 end if;
 if p_mode is distinct from 'dispatch' then raise exception 'Invalid worker mode'; end if;
 -- Also supports authorized manual calls independently of the scheduler.
 perform public.process_feature_jobs();
 select coalesce(jsonb_agg(to_jsonb(j)),'[]'::jsonb) into jobs from public.claim_feature_notifications() j;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into receipts from (
  select ticket_id,user_id,token from public.feature_push_receipts
  where checked_at is null and created_at < now()-interval '15 minutes'
  order by created_at,ticket_id limit 100
 ) r;
 select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) into cleanup from (
  select path from public.capsule_cleanup order by created_at,path limit 50
 ) c;
 return jsonb_build_object('authorized',true,'jobs',jobs,'receipts',receipts,'cleanup',cleanup);
end $$;
revoke all on function public.feature_worker_batch(text,text) from public,anon,authenticated;
grant execute on function public.feature_worker_batch(text,text) to service_role;

-- Cron runs as postgres; clients cannot invoke this privileged network path.
create or replace function public.dispatch_feature_worker() returns bigint
language plpgsql security invoker set search_path = '' as $$
declare secret text; request_id bigint;
begin
 if not pg_try_advisory_xact_lock(hashtext('pulse-worker-dispatch')) then return null; end if;
 -- Check-in, game, capsule and reminder deadlines are still checked EVERY MINUTE.
 perform public.process_feature_jobs();
 if not (
  exists(select 1 from public.feature_notifications n where n.delivered_at is null
   and n.attempts < 5 and coalesce(n.leased_until,'2000-01-01'::timestamptz)<now()
   and (n.tag<>'game-reminder' or public.game_reminder_ready(n.id)))
  or exists(select 1 from public.feature_push_receipts where checked_at is null and created_at<now()-interval '15 minutes')
  or exists(select 1 from public.capsule_cleanup)
 ) then return null; end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name='push_secret' limit 1;
 if secret is null or secret='' then raise exception 'Worker secret missing'; end if;
 select net.http_post(
  url:='https://xptsgwcywxphledcafvs.supabase.co/functions/v1/feature-worker',
  headers:=jsonb_build_object('Content-Type','application/json','x-push-secret',secret),
  body:='{}'::jsonb, timeout_milliseconds:=60000
 ) into request_id;
 return request_id;
end $$;
revoke all on function public.dispatch_feature_worker() from public,anon,authenticated,service_role;

-- Existing feature retention is unchanged; expensive cleanup runs once daily.
create or replace function public.feature_daily_maintenance() returns void
language plpgsql security invoker set search_path = '' as $$
declare today date := (now() at time zone 'Europe/Rome')::date; claimed integer;
begin
 insert into public.feature_job_runs(job,day) values ('technical-maintenance',today)
 on conflict do nothing;
 get diagnostics claimed = row_count;
 if claimed = 0 then return; end if;
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

 perform public.prune_feature_technical_history();
end $$;
revoke all on function public.feature_daily_maintenance() from public,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.process_feature_jobs_core()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
 perform public.feature_daily_maintenance();
 insert into public.feature_heartbeat(id,checked_at)values(true,now())on conflict(id)do update set checked_at=now();
end $function$
;

-- Rescheduling by name updates the existing job rather than creating duplicates.
select cron.schedule('pulse-feature-worker','* * * * *','select public.dispatch_feature_worker();');
commit;
