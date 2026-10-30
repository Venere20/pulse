-- Keep cancellation separate from a completed draw and retain the latest match.
-- No historical results, RLS policies or notification functions are changed.
begin;
alter table public.game_matches drop constraint game_matches_status_check;
alter table public.game_matches add constraint game_matches_status_check
  check (status in ('playing', 'won', 'draw', 'cancelled'));
commit;
