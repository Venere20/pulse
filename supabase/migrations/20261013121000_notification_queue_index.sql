-- Worker claim scans only unfinished, retryable jobs, with safety alerts first.
-- No policy/grant or delivery behavior changes.
create index if not exists feature_notifications_pending_idx
 on public.feature_notifications ((tag like 'checkin%') desc,created_at)
 where delivered_at is null and attempts<5;
