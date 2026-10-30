begin;
-- Align legacy two-minute defaults without changing active trips or saved routes.
update public.feature_preferences set checkin_grace_minutes=5 where checkin_grace_minutes<5;
alter table public.feature_preferences drop constraint feature_preferences_checkin_grace_minutes_check;
alter table public.feature_preferences add constraint feature_preferences_checkin_grace_minutes_check check(checkin_grace_minutes between 5 and 30);
alter table public.feature_preferences alter column checkin_grace_minutes set default 10;
commit;
