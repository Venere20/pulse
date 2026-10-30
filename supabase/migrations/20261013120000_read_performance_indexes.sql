-- Match the hot reads, including their deterministic ordering. Permissions,
-- policies, uniqueness constraints and existing indexes remain unchanged.
create index if not exists pulse_logs_recent_idx
 on public.pulse_logs(created_at desc);
create index if not exists partner_games_history_idx
 on public.partner_games(game,created_at desc,id asc);
