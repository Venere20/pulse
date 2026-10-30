begin;
lock table public.feature_notifications in share row exclusive mode;
-- Do not silently discard a live legacy delivery during the transition.
do $$ begin
 if exists(select 1 from public.feature_notifications where delivered_at is null and tag in('checkin','checkin-alert')) then
  raise exception 'Pending legacy check-in deliveries: reconcile before applying this migration';
 end if;
end $$;
alter table public.feature_notifications add column checkin_id uuid references public.safe_checkins(id) on delete set null;
alter table public.feature_notifications add column checkin_due_at timestamptz;
alter table public.feature_notifications add column checkin_phase text check(checkin_phase in('started','prompt','alerted','extended','arrived','cancelled'));
alter table public.feature_notifications add column cancelled_at timestamptz;
create index feature_checkin_pending on public.feature_notifications(checkin_id) where delivered_at is null and cancelled_at is null;

create function public.checkin_notification_ready(p_notification uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select coalesce((select n.cancelled_at is null and case
  when n.checkin_phase is null then n.tag not in('checkin','checkin-alert')
  when c.id is null then false
  when n.checkin_phase='started' then c.status='active' and c.due_at>now()
  when n.checkin_phase='prompt' then c.status='active' and c.due_at=n.checkin_due_at and c.due_at<=now()
  when n.checkin_phase='alerted' then c.status='alerted' and c.due_at=n.checkin_due_at
  when n.checkin_phase='extended' then c.status='active' and c.due_at=n.checkin_due_at and c.due_at>now()
  when n.checkin_phase='arrived' then c.status='arrived'
  when n.checkin_phase='cancelled' then c.status='cancelled'
  else false end
 from public.feature_notifications n left join public.safe_checkins c on c.id=n.checkin_id where n.id=p_notification),false)
$$;

create function public.queue_checkin_notification(p_checkin uuid,p_user uuid,p_phase text,p_title text,p_body text,p_tag text,p_url text) returns void
language sql security definer set search_path=public as $$
 insert into public.feature_notifications(user_id,title,body,tag,url,checkin_id,checkin_due_at,checkin_phase)
 select p_user,p_title,p_body,p_tag,p_url,c.id,c.due_at,p_phase from public.safe_checkins c where c.id=p_checkin and p_user is not null
$$;

create function public.invalidate_checkin_notifications() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 update public.feature_notifications n set cancelled_at=now(),leased_until=null
 where n.checkin_id=new.id and n.delivered_at is null and n.cancelled_at is null and not public.checkin_notification_ready(n.id);
 -- Keep the history, but an obsolete alert must not remain an unread novelty.
 update public.notification_inbox i set read_at=now() where i.read_at is null and exists(
  select 1 from public.feature_notifications n where n.id=i.id and n.checkin_id=new.id and not public.checkin_notification_ready(n.id));
 return new;
end $$;
create trigger checkin_notification_invalidation after update of status,due_at on public.safe_checkins
for each row when(old.status is distinct from new.status or old.due_at is distinct from new.due_at)
execute function public.invalidate_checkin_notifications();

-- Rewrite only queue calls; keep existing authentication, locks and limits.
do $$ declare name text; signature regprocedure; original text; patched text; begin
 foreach name in array array['start_checkin','update_checkin','update_checkin_v2','process_checkin_jobs_v2'] loop
  select p.oid::regprocedure into strict signature from pg_proc p where p.pronamespace='public'::regnamespace and p.proname=name;
  select pg_get_functiondef(signature) into original;patched:=original;
  if name='start_checkin' then
   patched:=replace(patched,'public.queue_feature_notification(public.partner_profile_id(),','public.queue_checkin_notification(cid,public.partner_profile_id(),''started'',');
  elsif name='update_checkin' then
   patched:=replace(patched,'public.queue_feature_notification(public.partner_profile_id(),','public.queue_checkin_notification(p_id,public.partner_profile_id(),''arrived'',');
  elsif name='update_checkin_v2' then
   patched:=replace(patched,'public.queue_feature_notification(public.partner_profile_id(),''🛡️ Orario','public.queue_checkin_notification(p_id,public.partner_profile_id(),''extended'',''🛡️ Orario');
   patched:=replace(patched,'public.queue_feature_notification(public.partner_profile_id(),''🛡️ Check-in annullato','public.queue_checkin_notification(p_id,public.partner_profile_id(),''cancelled'',''🛡️ Check-in annullato');
  else
   patched:=replace(patched,'public.queue_feature_notification(c.user_id,''🛡️ Arrivo','public.queue_checkin_notification(c.id,c.user_id,''alerted'',''🛡️ Arrivo');
   patched:=replace(patched,'public.queue_feature_notification(c.user_id,''🛡️ Sei','public.queue_checkin_notification(c.id,c.user_id,''prompt'',''🛡️ Sei');
   patched:=replace(patched,'public.queue_feature_notification((select id from public.users where id<>c.user_id order by id limit 1),','public.queue_checkin_notification(c.id,(select id from public.users where id<>c.user_id order by id limit 1),''alerted'',');
  end if;
  if patched=original or position('public.queue_feature_notification(' in patched)>0 then raise exception 'Queue patch incomplete: %',name;end if;
  execute patched;
 end loop;
 select pg_get_functiondef('public.claim_feature_notifications()'::regprocedure) into original;
 patched:=replace(original,'where delivered_at is null and','where delivered_at is null and n.cancelled_at is null and (n.tag not in(''checkin'',''checkin-alert'') or public.checkin_notification_ready(n.id)) and');
 if patched=original then raise exception 'Claim guard not found';end if;execute patched;
 select pg_get_functiondef('public.dispatch_feature_worker()'::regprocedure) into original;
 patched:=replace(original,'where n.delivered_at is null','where n.delivered_at is null and n.cancelled_at is null and (n.tag not in(''checkin'',''checkin-alert'') or public.checkin_notification_ready(n.id))');
 if patched=original then raise exception 'Dispatch guard not found';end if;execute patched;
end $$;
revoke all on function public.checkin_notification_ready(uuid),public.queue_checkin_notification(uuid,uuid,text,text,text,text,text),public.invalidate_checkin_notifications() from public,anon,authenticated;
grant execute on function public.checkin_notification_ready(uuid) to service_role;
commit;
