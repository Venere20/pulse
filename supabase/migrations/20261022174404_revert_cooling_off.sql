begin;
select pg_advisory_xact_lock(hashtext('pulse-cooling-off'));
-- Roll back only Cooling off. Preserve pre-existing content, policies and jobs.
do $$declare t record;begin
 for t in select tgname, tgrelid::regclass as rel from pg_trigger where not tgisinternal and tgname in ('cooling_write_guard','cooling_pulse_limit','cooling_notice','cooling_inbox') loop
 execute format('drop trigger %I on %s',t.tgname,t.rel);end loop;
end $$;
drop policy if exists cooling_storage_insert on storage.objects;
drop policy if exists cooling_storage_update on storage.objects;
drop policy if exists cooling_storage_delete on storage.objects;
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
CREATE OR REPLACE FUNCTION public.dispatch_feature_worker()
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end $function$
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
revoke all on function public.cooling_off_start(text,integer),public.cooling_off_respond(uuid,uuid,boolean,text,integer) from public,anon,authenticated,service_role;
delete from public.cooling_off_state;
delete from public.feature_notifications where tag='cooling-off' and delivered_at is null;
delete from public.notification_inbox where tag='cooling-off';
-- Empty SELECT-compatible state remains for clients downloading the rollback.
-- No client may reactivate it; old clients can still observe that no pause exists.
commit;
