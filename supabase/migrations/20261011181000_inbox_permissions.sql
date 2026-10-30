-- Supabase installations can grant table privileges through default privileges.
-- Keep the inbox read-only from the client independently of those defaults.
begin;
revoke all on public.notification_inbox from anon,authenticated;
grant select on public.notification_inbox to authenticated;
commit;
