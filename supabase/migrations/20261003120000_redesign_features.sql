-- Redesign + nuove funzionalità: Pulse con messaggio/risposta, domanda del giorno, bucket list collegata agli incontri.
-- Idempotente. Si basa sullo schema reale (users.id, visits.id, bucket_list.id sono uuid).

-- 1) Pulse con messaggio e risposta ---------------------------------------------------------
alter table public.pulse_logs
  add column if not exists message text,
  add column if not exists reply_to uuid;

-- 2) Domanda del giorno (minigame) ---------------------------------------------------------
create table if not exists public.daily_answers (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  question_id int not null,
  user_id uuid not null,
  choice smallint not null check (choice between 0 and 3),
  created_at timestamptz not null default now(),
  unique (day, user_id)
);
create index if not exists daily_answers_day_idx on public.daily_answers(day);

-- 3) Desideri della bucket list pianificati per un incontro ---------------------------------
create table if not exists public.visit_bucket_items (
  visit_id uuid not null references public.visits(id) on delete cascade,
  bucket_item_id uuid not null references public.bucket_list(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (visit_id, bucket_item_id)
);

-- 4) RLS aperto (stessa impostazione del resto dell'app: nessun login, ID utente fissi) ------
alter table public.daily_answers enable row level security;
drop policy if exists "daily_answers_open_access" on public.daily_answers;
create policy "daily_answers_open_access" on public.daily_answers
  for all to anon, authenticated using (true) with check (true);

alter table public.visit_bucket_items enable row level security;
drop policy if exists "visit_bucket_items_open_access" on public.visit_bucket_items;
create policy "visit_bucket_items_open_access" on public.visit_bucket_items
  for all to anon, authenticated using (true) with check (true);

-- 5) Realtime --------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['daily_answers','visit_bucket_items','pulse_logs'] loop
    if to_regclass('public.' || t) is not null
       and not exists (select 1 from pg_publication_tables
                       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
