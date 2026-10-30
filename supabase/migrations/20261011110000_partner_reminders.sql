begin;
create table public.partner_reminders (
 id uuid primary key default gen_random_uuid(),author_id uuid not null references public.users(id),
 recipient_id uuid not null references public.users(id),title text not null check(length(btrim(title))between 1 and 80),
 note text not null default '' check(length(note)<=300),due_at timestamptz not null,
 status text not null default 'open' check(status in('open','done','cancelled')),notified_at timestamptz,
 created_at timestamptz not null default now(),check(author_id<>recipient_id)
);
alter table public.partner_reminders enable row level security;
create policy reminder_read on public.partner_reminders for select to authenticated using(public.is_couple_member());
grant select on public.partner_reminders to authenticated;
create index reminders_due on public.partner_reminders(due_at)where status='open'and notified_at is null;
create function public.create_partner_reminder(p_title text,p_note text,p_due timestamptz)returns uuid
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id(); rid uuid;
begin
 if p_due is null or p_due<now()+interval'1 minute' or p_due>now()+interval'6 months' then raise exception 'Scegli un momento futuro entro sei mesi';end if;
 insert into public.partner_reminders(author_id,recipient_id,title,note,due_at)values(me,public.partner_profile_id(),btrim(p_title),btrim(coalesce(p_note,'')),p_due)returning id into rid;
 return rid;
end $$;
create function public.partner_reminder_action(p_id uuid,p_action text)returns void
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id(); r public.partner_reminders;
begin
 select * into r from public.partner_reminders where id=p_id for update;
 if r.id is null then raise exception 'Promemoria non trovato';end if;
 if p_action='done'and r.recipient_id=me then update public.partner_reminders set status='done'where id=p_id and status='open';
 elsif p_action='cancel'and r.author_id=me then update public.partner_reminders set status='cancelled'where id=p_id and status='open';
 else raise exception 'Operazione non consentita';end if;
end $$;
create function public.process_reminder_jobs()returns void
language plpgsql security definer set search_path=public as $$
declare r public.partner_reminders;
begin
 for r in select * from public.partner_reminders where status='open'and notified_at is null and due_at<=now()for update skip locked loop
 update public.partner_reminders set notified_at=now()where id=r.id;
 if r.due_at>now()-interval'24 hours' then perform public.queue_feature_notification(r.recipient_id,'💬 Ricordati di chiedermi','Il partner ti ha lasciato un promemoria.','reminder','/promemoria');end if;
 end loop;
end $$;
alter function public.process_feature_jobs()rename to process_feature_jobs_core;
create function public.process_feature_jobs()returns void
language plpgsql security definer set search_path=public as $$
begin
 if not pg_try_advisory_xact_lock(hashtext('pulse-relationship-jobs'))then return;end if;
 perform public.process_feature_jobs_core(); perform public.process_reminder_jobs();
end $$;
revoke all on function public.create_partner_reminder(text,text,timestamptz),public.partner_reminder_action(uuid,text),public.process_reminder_jobs(),public.process_feature_jobs()from public,anon,authenticated;
grant execute on function public.create_partner_reminder(text,text,timestamptz),public.partner_reminder_action(uuid,text)to authenticated;
grant execute on function public.process_feature_jobs(),public.process_reminder_jobs()to service_role;
alter publication supabase_realtime add table public.partner_reminders;
commit;
