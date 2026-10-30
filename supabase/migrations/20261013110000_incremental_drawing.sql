-- Additive RPC: older clients may still submit full drawings to play_partner_game.
-- New clients send only new strokes or truncate the unchanged prefix for undo.
create or replace function public.patch_partner_drawing(
 p_id uuid, p_drawing_revision integer, p_keep_count integer, p_strokes jsonb
) returns void language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id(); m public.partner_games; prefix jsonb;
begin
 select * into m from public.partner_games
 where id=p_id and me in(player_a,player_b) for update;
 if m.id is null or m.game<>'drawguess' or m.status<>'playing' then
  raise exception 'Partita non disponibile';
 end if;
 if me is distinct from (m.state->>'drawer')::uuid then
  raise exception 'Solo chi disegna può modificare la lavagna';
 end if;
 if p_drawing_revision is distinct from (m.state->>'drawing_revision')::integer then
  raise exception 'Il disegno è cambiato: aggiorna e riprova';
 end if;
 if p_keep_count is null or p_keep_count<0 or p_keep_count>jsonb_array_length(m.state->'strokes')
  or jsonb_typeof(p_strokes) is distinct from 'array'
  or jsonb_array_length(p_strokes)>60 or octet_length(p_strokes::text)>100000 then
  raise exception 'Modifica del disegno non valida';
 end if;
 select coalesce(jsonb_agg(value order by ordinal),'[]'::jsonb) into prefix
 from jsonb_array_elements(m.state->'strokes') with ordinality as t(value,ordinal)
 where ordinal<=p_keep_count;
 -- Reuse the existing authoritative validation, limits, revision increment and
 -- no-notification behavior for drawing. The row lock remains held throughout.
 perform public.play_partner_game(p_id,'draw',
  jsonb_build_object('drawing_revision',p_drawing_revision,'strokes',prefix||p_strokes),m.revision);
end $$;
revoke all on function public.patch_partner_drawing(uuid,integer,integer,jsonb) from public,anon;
grant execute on function public.patch_partner_drawing(uuid,integer,integer,jsonb) to authenticated;
