begin;
-- Additive entry points: old clients keep the original UUID/void contracts.
-- Return only the public match row, never partner_game_secrets.
create function public.start_partner_game_state(p_game text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare mid uuid; result jsonb; me uuid:=public.my_profile_id();
begin
 mid:=public.start_partner_game(p_game);
 select to_jsonb(m) into result from public.partner_games m
 where m.id=mid and me in(m.player_a,m.player_b) for update;
 if result is null then raise exception 'Partita non disponibile'; end if;
 return result;
end $$;

create function public.play_partner_game_state(p_id uuid,p_action text,p_data jsonb default '{}',p_revision integer default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb; me uuid:=public.my_profile_id();
begin
 perform public.play_partner_game(p_id,p_action,p_data,p_revision);
 select to_jsonb(m) into result from public.partner_games m
 where m.id=p_id and me in(m.player_a,m.player_b);
 if result is null then raise exception 'Partita non disponibile'; end if;
 return result;
end $$;

create function public.patch_partner_drawing_state(p_id uuid,p_drawing_revision integer,p_keep_count integer,p_strokes jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb; me uuid:=public.my_profile_id();
begin
 perform public.patch_partner_drawing(p_id,p_drawing_revision,p_keep_count,p_strokes);
 select to_jsonb(m) into result from public.partner_games m
 where m.id=p_id and me in(m.player_a,m.player_b);
 if result is null then raise exception 'Partita non disponibile'; end if;
 return result;
end $$;

revoke all on function public.start_partner_game_state(text),public.play_partner_game_state(uuid,text,jsonb,integer),public.patch_partner_drawing_state(uuid,integer,integer,jsonb) from public,anon;
grant execute on function public.start_partner_game_state(text),public.play_partner_game_state(uuid,text,jsonb,integer),public.patch_partner_drawing_state(uuid,integer,integer,jsonb) to authenticated;
commit;
