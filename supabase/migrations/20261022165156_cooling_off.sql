begin;
-- Current state only: no pause history, reasons in notifications or analytics.
create table public.cooling_off_state (
 id boolean primary key default true check(id),
 session_id uuid not null default gen_random_uuid(), round_id uuid not null default gen_random_uuid(),
 participant_a uuid not null references public.users(id) on delete cascade,
 participant_b uuid not null references public.users(id) on delete cascade,
 started_by uuid not null references public.users(id), started_at timestamptz not null default now(),
 check_at timestamptz not null, reasons jsonb not null default '{}', replies jsonb not null default '{}',
 pulse_count smallint not null default 0 check(pulse_count between 0 and 5),
 prompted boolean not null default false, check(participant_a<>participant_b)
);
alter table public.cooling_off_state enable row level security;
revoke all on public.cooling_off_state from public,anon,authenticated;
grant select on public.cooling_off_state to authenticated;
grant all on public.cooling_off_state to service_role;
create policy cooling_read on public.cooling_off_state for select to authenticated
 using(case when public.is_couple_member() then public.my_profile_id() in(participant_a,participant_b) else false end);
alter publication supabase_realtime add table public.cooling_off_state;

create function public.cooling_off_active() returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.cooling_off_state)
$$;
revoke all on function public.cooling_off_active() from public,anon;
grant execute on function public.cooling_off_active() to authenticated,service_role;

create function public.cooling_off_notice_allowed(p_tag text) returns boolean language sql immutable security invoker set search_path='' as $$
 select coalesce(p_tag like 'checkin%' or p_tag='cooling-off' or p_tag='pulse',false)
$$;
revoke all on function public.cooling_off_notice_allowed(text) from public,anon;
grant execute on function public.cooling_off_notice_allowed(text) to authenticated,service_role;

create function public.cooling_off_start(p_reason text,p_minutes integer) returns public.cooling_off_state
language plpgsql security definer set search_path='' as $$
declare me uuid;partner uuid;s public.cooling_off_state;reason text;
begin
 if not public.is_couple_member() then raise exception 'Accesso non consentito';end if;
 me:=public.my_profile_id();partner:=public.partner_profile_id();
 reason:=regexp_replace(coalesce(p_reason,''),'^[[:space:]]+|[[:space:]]+$','','g');
 if char_length(reason) not between 1 and 500 then raise exception 'Scrivi cosa ti ha dato fastidio: da 1 a 500 caratteri';end if;
 if p_minutes is null or p_minutes not between 20 and 1440 then raise exception 'Scegli una durata tra 20 minuti e 24 ore';end if;
 if partner is null or partner=me then raise exception 'Serve il partner';end if;
 perform pg_advisory_xact_lock(hashtext('pulse-cooling-off'));
 if exists(select 1 from public.cooling_off_state)then raise exception 'Una pausa è già attiva';end if;
 insert into public.cooling_off_state(participant_a,participant_b,started_by,check_at,reasons)
 values(least(me,partner),greatest(me,partner),me,clock_timestamp()+make_interval(mins=>p_minutes),jsonb_build_object(me::text,reason))returning * into s;
 perform public.queue_feature_notification(partner,'Una pausa per voi','È iniziato il Cooling off. Apri Pulse per leggere il motivo e l’orario.','cooling-off','/cooling-off');
 return s;
end $$;

create function public.cooling_off_respond(p_session uuid,p_round uuid,p_ready boolean,p_reason text default '',p_minutes integer default null) returns public.cooling_off_state
language plpgsql security definer set search_path='' as $$
declare me uuid;s public.cooling_off_state;answer jsonb;old_answer jsonb;reason text;a jsonb;b jsonb;delay_minutes numeric;
begin
 if not public.is_couple_member()then raise exception 'Accesso non consentito';end if;
 me:=public.my_profile_id();
 perform pg_advisory_xact_lock(hashtext('pulse-cooling-off'));
 select * into s from public.cooling_off_state where id for update;
 if s.session_id is null or s.session_id is distinct from p_session or s.round_id is distinct from p_round then raise exception 'La pausa è cambiata: aggiorna la schermata';end if;
 if me not in(s.participant_a,s.participant_b)or p_ready is null then raise exception 'Accesso non consentito';end if;
 if s.check_at>clock_timestamp()then raise exception 'La conferma sarà disponibile all’orario concordato';end if;
 reason:=regexp_replace(coalesce(p_reason,''),'^[[:space:]]+|[[:space:]]+$','','g');
 if not p_ready and(char_length(reason)not between 1 and 500 or p_minutes is null or p_minutes not between 20 and 1440)then raise exception 'Indica il motivo (massimo 500 caratteri) e una durata tra 20 minuti e 24 ore';end if;
 old_answer:=s.replies->me::text;
 answer:=jsonb_build_object('ready',p_ready,'minutes',case when p_ready then null else p_minutes end,'reason',case when p_ready then null else reason end,'changed',false);
 if old_answer is not null then
  if (old_answer-'changed')=(answer-'changed')then return s;end if;
  if (old_answer->>'changed')::boolean then raise exception 'Puoi cambiare risposta una sola volta per questa conferma';end if;
  answer:=jsonb_set(answer,'{changed}','true');
 end if;
 s.replies:=s.replies||jsonb_build_object(me::text,answer);
 if not p_ready then s.reasons:=s.reasons||jsonb_build_object(me::text,reason);end if;
 a:=s.replies->s.participant_a::text;b:=s.replies->s.participant_b::text;
 if a is not null and b is not null then
  if (a->>'ready')::boolean and(b->>'ready')::boolean then
   delete from public.cooling_off_state where id;
   delete from public.notification_inbox where tag='cooling-off';
   -- No private text is queued. Keep only ordinary technical delivery records.
   delete from public.feature_notifications where tag='cooling-off'and delivered_at is null;
   perform public.queue_feature_notification(s.participant_a,'Pausa conclusa','Avete confermato entrambi: Pulse è di nuovo disponibile.','cooling-off','/');
   perform public.queue_feature_notification(s.participant_b,'Pausa conclusa','Avete confermato entrambi: Pulse è di nuovo disponibile.','cooling-off','/');
   delete from public.notification_inbox where tag='cooling-off';
   return null;
  end if;
  select avg((v->>'minutes')::numeric)into delay_minutes from jsonb_each(s.replies)e(k,v)where not(v->>'ready')::boolean;
  s.check_at:=clock_timestamp()+make_interval(secs=>(delay_minutes*60)::double precision);
  s.round_id:=gen_random_uuid();s.replies:='{}';s.prompted:=false;
  delete from public.notification_inbox where tag='cooling-off';
  perform public.queue_feature_notification(s.participant_a,'Un altro momento di pausa','La pausa continua. Apri Pulse per il motivo e il nuovo orario.','cooling-off','/cooling-off');
  perform public.queue_feature_notification(s.participant_b,'Un altro momento di pausa','La pausa continua. Apri Pulse per il motivo e il nuovo orario.','cooling-off','/cooling-off');
 end if;
 update public.cooling_off_state set reasons=s.reasons,replies=s.replies,check_at=s.check_at,round_id=s.round_id,prompted=s.prompted where id returning * into s;
 return s;
end $$;
revoke all on function public.cooling_off_start(text,integer),public.cooling_off_respond(uuid,uuid,boolean,text,integer) from public,anon;
grant execute on function public.cooling_off_start(text,integer),public.cooling_off_respond(uuid,uuid,boolean,text,integer) to authenticated;

create function public.cooling_off_due() returns void language plpgsql security invoker set search_path='' as $$
declare s public.cooling_off_state;
begin
 select * into s from public.cooling_off_state where id and not prompted and check_at<=clock_timestamp() for update skip locked;
 if s.session_id is null then return;end if;
 update public.cooling_off_state set prompted=true where id;
 perform public.queue_feature_notification(s.participant_a,'Come state adesso?','È il momento di confermare se terminare il Cooling off.','cooling-off','/cooling-off');
 perform public.queue_feature_notification(s.participant_b,'Come state adesso?','È il momento di confermare se terminare il Cooling off.','cooling-off','/cooling-off');
end $$;
revoke all on function public.cooling_off_due() from public,anon,authenticated;
grant execute on function public.cooling_off_due() to service_role;

-- The existing minute job handles the deadline; no additional cron/network poll.
create or replace function public.process_feature_jobs() returns void language plpgsql security definer set search_path='' as $$
begin
 if not pg_try_advisory_xact_lock(hashtext('pulse-relationship-jobs'))then return;end if;
 perform public.cooling_off_due();perform public.process_feature_jobs_core();
 if not public.cooling_off_active()then
  perform public.process_reminder_jobs();perform public.process_remote_date_jobs();perform public.process_anniversary_jobs();perform public.process_game_reminders();
 end if;
 delete from public.emotional_states where expires_at<=now();delete from public.care_requests where expires_at<=now();
end $$;
revoke all on function public.process_feature_jobs() from public,anon,authenticated;
grant execute on function public.process_feature_jobs() to service_role;

create or replace function public.claim_feature_notifications() returns table(id uuid,user_id uuid,title text,body text,tag text,url text,expo_token text,web_subscription jsonb,expo_done boolean,web_done boolean,attempts integer)
language sql security definer set search_path='' as $$
 with selected as(select n.id from public.feature_notifications n where delivered_at is null
 and(not public.cooling_off_active()or public.cooling_off_notice_allowed(n.tag))
 and(n.tag<>'game-reminder'or public.game_reminder_ready(n.id))and attempts<5 and coalesce(leased_until,'2000-01-01')<now()
 order by(tag like 'checkin%')desc,created_at limit 10 for update skip locked),
 claimed as(update public.feature_notifications n set leased_until=now()+interval'2 minutes',attempts=attempts+1 from selected s where n.id=s.id returning n.*)
 select c.id,c.user_id,c.title,c.body,c.tag,c.url,u.expo_push_token,u.web_push_subscription,c.expo_done,c.web_done,c.attempts from claimed c join public.users u on u.id=c.user_id
$$;
revoke all on function public.claim_feature_notifications()from public,anon,authenticated;
grant execute on function public.claim_feature_notifications()to service_role;

create function public.cooling_off_filter_notice() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if public.cooling_off_active()and not public.cooling_off_notice_allowed(new.tag)then return null;end if;
 return new;
end $$;
revoke all on function public.cooling_off_filter_notice()from public,anon,authenticated;
create trigger cooling_notice before insert or update on public.feature_notifications for each row execute function public.cooling_off_filter_notice();
create trigger cooling_inbox before insert on public.notification_inbox for each row execute function public.cooling_off_filter_notice();

-- Do not wake the network worker every minute for notices paused by this mode.
create or replace function public.dispatch_feature_worker() returns bigint
language plpgsql security invoker set search_path='' as $$
declare secret text;request_id bigint;
begin
 if not pg_try_advisory_xact_lock(hashtext('pulse-worker-dispatch'))then return null;end if;
 perform public.process_feature_jobs();
 if not(
  exists(select 1 from public.feature_notifications n where n.delivered_at is null
   and(not public.cooling_off_active()or public.cooling_off_notice_allowed(n.tag))
   and n.attempts<5 and coalesce(n.leased_until,'2000-01-01'::timestamptz)<now()
   and(n.tag<>'game-reminder'or public.game_reminder_ready(n.id)))
  or exists(select 1 from public.feature_push_receipts where checked_at is null and created_at<now()-interval'15 minutes')
  or exists(select 1 from public.capsule_cleanup)
 )then return null;end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name='push_secret'limit 1;
 if secret is null or secret=''then raise exception 'Worker secret missing';end if;
 select net.http_post(url:='https://xptsgwcywxphledcafvs.supabase.co/functions/v1/feature-worker',
 headers:=jsonb_build_object('Content-Type','application/json','x-push-secret',secret),body:='{}'::jsonb,timeout_milliseconds:=60000)into request_id;
 return request_id;
end $$;
revoke all on function public.dispatch_feature_worker()from public,anon,authenticated,service_role;

-- Guard ordinary clients AND existing security-definer mutation RPCs. Jobs with
-- no end-user JWT retain their normal behavior; no existing policy is removed.
create function public.cooling_off_guard_data() returns trigger language plpgsql security definer set search_path='' as $$
declare s public.cooling_off_state;
begin
 if auth.uid()is null then if tg_op='DELETE'then return old;else return new;end if;end if;
 perform pg_advisory_xact_lock(hashtext('pulse-cooling-off'));
 select * into s from public.cooling_off_state where id;
 if s.session_id is null then if tg_op='DELETE'then return old;else return new;end if;end if;
 if tg_table_name='users'and tg_op='UPDATE'and(to_jsonb(new)-array['expo_push_token','web_push_subscription'])=(to_jsonb(old)-array['expo_push_token','web_push_subscription'])then return new;end if;
 if tg_table_name='safe_checkins'and tg_op='UPDATE'then
  if old.created_at<=s.started_at and old.status in('active','alerted')and new.user_id=old.user_id and new.label=old.label and new.note is not distinct from old.note then return new;end if;
 end if;
 if tg_table_name='time_capsules'and tg_op='UPDATE'then
  if old.recipient_id=public.my_profile_id()and old.status<>'draft'and new.status='open'
   and(to_jsonb(new)-array['status','opened_at','read_at','updated_at'])=(to_jsonb(old)-array['status','opened_at','read_at','updated_at'])
   and(public.capsule_is_open(old.id)or old.unlock_kind='manual')then return new;end if;
 end if;
 raise exception 'Cooling off attivo: sono disponibili solo Pulse, Capsule e Ricordi in lettura e i check-in già avviati';
end $$;
revoke all on function public.cooling_off_guard_data()from public,anon,authenticated;
do $$declare t text;begin
 foreach t in array array['users','couple_settings','visits','trip_expenses','settlements','bucket_list','visit_bucket_items','daily_answers','game_matches','wyr_answers','anniversaries','badge_awards','badge_reads','bucket_details','bucket_preferences','call_log','canvas_current','canvas_drawings','capsule_contents','capsule_photo_uploads','care_requests','date_options','date_proposal_wishes','date_proposals','date_votes','deep_talk_answers','deep_talk_marks','deep_talk_versions','emotional_states','events','feature_preferences','food_preferences','fridge_notes','fridge_reactions','fridge_reads','game_screen_presence','game_turn_waits','giovi_attempts','giovi_pearls','giovi_vault','monthly_reflections','packing_defaults','packing_items','packing_lists','packing_progress','partner_game_secrets','partner_games','partner_reminders','remote_dates','safe_checkins','story_moments','time_capsules']loop
  if to_regclass('public.'||t)is not null then execute format('create trigger cooling_write_guard before insert or update or delete on public.%I for each row execute function public.cooling_off_guard_data()',t);end if;
 end loop;
end $$;

create function public.cooling_off_guard_pulse() returns trigger language plpgsql security definer set search_path='' as $$
declare s public.cooling_off_state;
begin
 perform pg_advisory_xact_lock(hashtext('pulse-cooling-off'));
 select * into s from public.cooling_off_state where id for update;
 if s.session_id is null then return new;end if;
 if not public.is_couple_member()or new.sender_id is distinct from public.my_profile_id()then raise exception 'Accesso non consentito';end if;
 if new.type='urgent'then raise exception 'Rispondimi non è disponibile durante il Cooling off';end if;
 if s.pulse_count>=5 then raise exception 'Avete già utilizzato i 5 Pulse complessivi della pausa';end if;
 update public.cooling_off_state set pulse_count=pulse_count+1 where id;
 return new;
end $$;
revoke all on function public.cooling_off_guard_pulse()from public,anon,authenticated;
create trigger cooling_pulse_limit before insert on public.pulse_logs for each row execute function public.cooling_off_guard_pulse();

create policy cooling_storage_insert on storage.objects as restrictive for insert to authenticated with check(not public.cooling_off_active());
create policy cooling_storage_update on storage.objects as restrictive for update to authenticated using(not public.cooling_off_active())with check(not public.cooling_off_active());
create policy cooling_storage_delete on storage.objects as restrictive for delete to authenticated using(not public.cooling_off_active());
commit;
