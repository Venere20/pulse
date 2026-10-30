begin;
-- Restore only the caller's moments, using the normal photo/date validation.
create function public.restore_story_moment(p_id uuid,p_title text,p_day date,p_body text,p_photo_paths text[],p_photo_settings jsonb,p_author uuid)returns boolean
language plpgsql security definer set search_path=public as $$
declare rid uuid;me uuid:=public.my_profile_id();
begin
 if me is null or p_author is distinct from me or not public.is_couple_member()then raise exception 'Puoi ripristinare solo i tuoi momenti';end if;
 if p_id is null then raise exception 'Momento non valido';end if;
 perform pg_advisory_xact_lock(hashtext('restore-story-'||p_id));
 if exists(select 1 from public.story_moments where id=p_id)then return false;end if;
 rid:=public.save_story_moment_v3(p_title,p_day,p_body,p_photo_paths,p_photo_settings);
 update public.story_moments set id=p_id where id=rid;
 return true;
end $$;
revoke all on function public.restore_story_moment(uuid,text,date,text,text[],jsonb,uuid)from public,anon;
grant execute on function public.restore_story_moment(uuid,text,date,text,text[],jsonb,uuid)to authenticated;
commit;
