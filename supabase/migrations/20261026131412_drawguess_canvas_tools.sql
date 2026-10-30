begin;
-- Extend only the drawing palette; preserve ink-only validation, ownership,
-- row locking, turns, guesses, cancellation, limits, signatures and privileges.
do $migration$
declare definition text;
begin
 definition := pg_get_functiondef('public.play_partner_game(uuid,text,jsonb,integer)'::regprocedure);
 if position($new$'#FF4D85','#FFCB47','#59CD90','#4DA3FF','#B07CFF','#FFFFFF','#282431','#FF7A59','#F04452','#FF9AA2','#F4B6D2','#9B2242','#D99B32','#FFE4B5','#B8E986','#237A57','#25B8AE','#78DCE8','#244DB4','#D8C5FF','#7939A9','#936447','#9CA3AF','#E5E7EB'$new$ in definition) > 0 then return; end if;
 if position($old$'#FF4D85','#FFCB47','#59CD90','#4DA3FF','#B07CFF','#FFFFFF','#282431','#FF7A59'$old$ in definition) = 0 then
   raise exception 'Validazione colori inattesa: verificare play_partner_game prima della migrazione';
 end if;
 definition := replace(definition, $old$'#FF4D85','#FFCB47','#59CD90','#4DA3FF','#B07CFF','#FFFFFF','#282431','#FF7A59'$old$, $new$'#FF4D85','#FFCB47','#59CD90','#4DA3FF','#B07CFF','#FFFFFF','#282431','#FF7A59','#F04452','#FF9AA2','#F4B6D2','#9B2242','#D99B32','#FFE4B5','#B8E986','#237A57','#25B8AE','#78DCE8','#244DB4','#D8C5FF','#7939A9','#936447','#9CA3AF','#E5E7EB'$new$);
 execute definition;
end $migration$;
commit;
