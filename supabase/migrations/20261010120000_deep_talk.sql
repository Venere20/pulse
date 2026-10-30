begin;
create table public.deep_talk_marks (
 week_start date not null,q_index smallint not null check(q_index between 0 and 2),user_id uuid not null references public.users(id) on delete cascade,
 deck_id text not null check(deck_id~'^[a-z0-9_-]{2,40}$'),status text not null check(status in ('answered','skipped')),
 discussed_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),primary key(week_start,q_index,user_id)
);
create table public.deep_talk_answers (
 week_start date not null,q_index smallint not null,user_id uuid not null references public.users(id) on delete cascade,
 body text not null check(length(btrim(body)) between 1 and 600),reaction text check(reaction in ('heart','hug','think')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),primary key(week_start,q_index,user_id),
 foreign key(week_start,q_index,user_id) references public.deep_talk_marks(week_start,q_index,user_id) on delete cascade
);
alter table public.deep_talk_marks enable row level security;
alter table public.deep_talk_answers enable row level security;
create or replace function public.deep_talk_can_view(p_week date,p_q smallint,p_author uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select public.is_couple_member() and (p_author=public.my_profile_id() or (select count(*)=2 from public.deep_talk_marks where week_start=p_week and q_index=p_q and status='answered'))
$$;
create policy marks_read on public.deep_talk_marks for select to authenticated using(public.is_couple_member());
create policy answers_read on public.deep_talk_answers for select to authenticated using(public.deep_talk_can_view(week_start,q_index,user_id));
revoke all on public.deep_talk_marks,public.deep_talk_answers from anon,authenticated;
grant select on public.deep_talk_marks,public.deep_talk_answers to authenticated;
alter publication supabase_realtime add table public.deep_talk_marks,public.deep_talk_answers;
create or replace function public.deep_talk_action(p_week date,p_q smallint,p_deck text,p_action text,p_body text default null) returns void
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id(); today date:=(now() at time zone 'Europe/Rome')::date; unlocked boolean; expected text; decks text[]:=array['valori-01','obiettivi-01','convivenza-01','soldi-01','famiglia-01','fiducia-01','gratitudine-01','limiti-01','affetto-01','distanza-01','sogni-01','ricordi-01'];
begin
 if p_week is null or extract(isodow from p_week)<>1 or p_q is null or p_q not between 0 and 2 then raise exception 'Domanda non valida'; end if;
 perform pg_advisory_xact_lock(hashtext('deep-talk-'||p_week||'-'||p_q));
 select count(*)=2 into unlocked from public.deep_talk_marks where week_start=p_week and q_index=p_q and status='answered';
 if p_action in ('answer','skip') then
  if p_week>today or p_week<today-14 then raise exception 'Settimana fuori dalla finestra di risposta'; end if;
  expected:=decks[(((p_week-date '2026-01-05')/7)%12+12)%12+1];
  if p_deck is distinct from expected then raise exception 'Carta non valida'; end if;
  if unlocked then raise exception 'Risposte già sbloccate'; end if;
  if p_action='skip' and exists(select 1 from public.deep_talk_answers where week_start=p_week and q_index=p_q and user_id=me) then raise exception 'Hai già risposto'; end if;
  insert into public.deep_talk_marks(week_start,q_index,user_id,deck_id,status) values(p_week,p_q,me,p_deck,case when p_action='answer' then 'answered' else 'skipped' end)
  on conflict(week_start,q_index,user_id) do update set status=excluded.status,updated_at=now();
  if p_action='answer' then
   insert into public.deep_talk_answers(week_start,q_index,user_id,body)values(p_week,p_q,me,btrim(p_body))on conflict(week_start,q_index,user_id)do update set body=excluded.body,updated_at=now();
   perform public.queue_feature_notification(public.partner_profile_id(),'🗝️ Deep Talk','Il partner ha risposto. Apri la carta per continuare.','deeptalk','/play/deeptalk');
  end if;
 elsif p_action='delete' then delete from public.deep_talk_marks where week_start=p_week and q_index=p_q and user_id=me;
 elsif p_action='react' then
  if not unlocked then raise exception 'Risposte ancora private'; end if;
  update public.deep_talk_answers set reaction=p_body,updated_at=now() where week_start=p_week and q_index=p_q and user_id=public.partner_profile_id();
 elsif p_action='discussed' then
  if not unlocked then raise exception 'Risposte ancora private'; end if;
  update public.deep_talk_marks set discussed_at=coalesce(discussed_at,now()),updated_at=now() where week_start=p_week and q_index=p_q;
 else raise exception 'Azione non valida'; end if;
end $$;
revoke all on function public.deep_talk_action(date,smallint,text,text,text),public.deep_talk_can_view(date,smallint,uuid) from public,anon;
grant execute on function public.deep_talk_action(date,smallint,text,text,text),public.deep_talk_can_view(date,smallint,uuid) to authenticated;
commit;
