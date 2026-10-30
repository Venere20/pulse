-- Roadmap features (versione compatibile con lo schema reale: users, events, pulse_logs, bucket_list, trip_expenses, couple_settings, visits)
-- Idempotente: si può rieseguire senza danni. Il tipo di visits.id viene letto dal DB (uuid, bigint, ...).

-- 1) Colonne nuove / di sicurezza -------------------------------------------------------------
alter table public.visits
  add column if not exists location text,
  add column if not exists meeting_point text,
  add column if not exists transport text,
  add column if not exists notes text,
  add column if not exists memory_notes text,
  add column if not exists memory_photos text[] default '{}',
  add column if not exists status text not null default 'planned',
  add column if not exists travel_km numeric,
  add column if not exists arrival_time text,
  add column if not exists hotel text,
  add column if not exists reminder_sent_at timestamptz;

update public.visits
set status = 'concluded'
where end_date::text < to_char(current_date, 'YYYY-MM-DD') and status = 'planned';

alter table public.users
  add column if not exists expo_push_token text,
  add column if not exists web_push_subscription jsonb,
  add column if not exists current_status text not null default 'home',
  add column if not exists status_updated_at timestamptz;

alter table public.trip_expenses
  add column if not exists category text not null default 'Altro',
  add column if not exists created_at timestamptz not null default now();

-- 2) visit_id su trip_expenses e tabella settlements, con lo stesso tipo di visits.id ---------
do $$
declare vtype text;
begin
  select format_type(a.atttypid, a.atttypmod) into vtype
  from pg_attribute a
  where a.attrelid = 'public.visits'::regclass and a.attname = 'id' and not a.attisdropped;

  execute format('alter table public.trip_expenses add column if not exists visit_id %s', vtype);

  execute format($f$
    create table if not exists public.settlements (
      id uuid primary key default gen_random_uuid(),
      visit_id %s not null references public.visits(id) on delete cascade,
      from_user_id uuid not null,
      to_user_id uuid not null,
      amount numeric(10,2) not null check (amount > 0),
      created_at timestamptz not null default now()
    )$f$, vtype);
end $$;

create index if not exists settlements_visit_idx on public.settlements(visit_id);
create index if not exists trip_expenses_visit_idx on public.trip_expenses(visit_id);

alter table public.settlements enable row level security;
drop policy if exists "settlements_open_access" on public.settlements;
create policy "settlements_open_access" on public.settlements
  for all to anon, authenticated using (true) with check (true);

-- 3) Realtime ---------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['visits','trip_expenses','settlements','bucket_list','pulse_logs','users','couple_settings'] loop
    if to_regclass('public.' || t) is not null
       and not exists (select 1 from pg_publication_tables
                       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- 4) Storage foto ricordi ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('meetings', 'meetings', true)
on conflict (id) do nothing;

drop policy if exists "meetings_read" on storage.objects;
create policy "meetings_read" on storage.objects for select using (bucket_id = 'meetings');
drop policy if exists "meetings_insert" on storage.objects;
create policy "meetings_insert" on storage.objects for insert with check (bucket_id = 'meetings');
drop policy if exists "meetings_update" on storage.objects;
create policy "meetings_update" on storage.objects for update using (bucket_id = 'meetings');
drop policy if exists "meetings_delete" on storage.objects;
create policy "meetings_delete" on storage.objects for delete using (bucket_id = 'meetings');
