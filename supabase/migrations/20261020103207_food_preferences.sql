begin;
create table public.food_preferences (
 id uuid primary key references public.users(id) on delete cascade,
 allergies text not null default '',
 diet text not null default '',
 likes text not null default '',
 dislikes text not null default '',
 drinks text not null default '',
 exceptions text not null default '',
 constraint food_preferences_text_length check (
  char_length(allergies)<=1000 and char_length(diet)<=1000 and
  char_length(likes)<=1000 and char_length(dislikes)<=1000 and
  char_length(drinks)<=1000 and char_length(exceptions)<=1000
 )
);
alter table public.food_preferences enable row level security;
revoke all on public.food_preferences from public,anon,authenticated;
grant select,insert,update on public.food_preferences to authenticated;
grant all on public.food_preferences to service_role;
create policy food_preferences_read on public.food_preferences for select to authenticated
 using(case when public.is_couple_member() then id in(public.my_profile_id(),public.partner_profile_id()) else false end);
create policy food_preferences_insert on public.food_preferences for insert to authenticated
 with check(case when public.is_couple_member() then id=public.my_profile_id() else false end);
create policy food_preferences_update on public.food_preferences for update to authenticated
 using(case when public.is_couple_member() then id=public.my_profile_id() else false end)
 with check(case when public.is_couple_member() then id=public.my_profile_id() else false end);
alter publication supabase_realtime add table public.food_preferences;
commit;
