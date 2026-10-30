begin;
-- Widen the existing allowlist; keep duration, note, ownership and notification rules.
alter table public.emotional_states drop constraint emotional_states_mood_check;
alter table public.emotional_states add constraint emotional_states_mood_check
 check(mood in('happy','calm','tired','sad','anxious','overwhelmed','loved','lonely','excited','annoyed','angry','sorry'));
commit;
