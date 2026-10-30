begin;
create or replace function public.valid_canvas_erasures(p jsonb) returns boolean
language plpgsql immutable set search_path=public as $f$
declare v jsonb;i integer:=0;
begin
 if jsonb_typeof(p) is distinct from 'array' then return false;end if;
 if jsonb_array_length(p)>640 or jsonb_array_length(p)%5<>0 then return false;end if;
 for v in select value from jsonb_array_elements(p) loop
  if jsonb_typeof(v) is distinct from 'number' then return false;end if;
  if i%5=4 then if v::text::numeric not between 1 and 40 then return false;end if;
  elsif v::text::numeric not between 0 and 1000 then return false;end if;
  i:=i+1;
 end loop;return true;
end $f$;
create or replace function public.merge_canvas_erasures(a jsonb,b jsonb) returns jsonb
language plpgsql immutable set search_path=public as $f$
declare result jsonb:=a;part jsonb;i integer;j integer;found boolean;
begin
 if not public.valid_canvas_erasures(a) or not public.valid_canvas_erasures(b) then raise exception 'Cancellazione non valida';end if;
 i:=0;while i<jsonb_array_length(b) loop
  part:=jsonb_build_array(b->i,b->(i+1),b->(i+2),b->(i+3),b->(i+4));found:=false;j:=0;
  while j<jsonb_array_length(result) loop
   if jsonb_build_array(result->j,result->(j+1),result->(j+2),result->(j+3),result->(j+4))=part then found:=true;exit;end if;
   j:=j+5;
  end loop;
  if not found then result:=result||part;end if;i:=i+5;
 end loop;
 if jsonb_array_length(result)>640 then raise exception 'Limite cancellazioni raggiunto per questo tratto';end if;
 return result;
end $f$;
revoke all on function public.valid_canvas_erasures(jsonb),public.merge_canvas_erasures(jsonb,jsonb) from public,anon;
grant execute on function public.valid_canvas_erasures(jsonb),public.merge_canvas_erasures(jsonb,jsonb) to authenticated;
-- Modify only eraser handling, preserving the installed function's ownership,
-- epoch, append-only point validation, limits, signatures and ACLs.
do $migration$
declare def text;needle text;
begin
 def:=pg_get_functiondef('public.apply_canvas_board(integer,text,jsonb,text)'::regprocedure);
 if position('p_action=''erase''' in def)=0 then
  needle:='p_action not in(''put'',''undo'',''clear'')';
  if position(needle in def)=0 then raise exception 'Validazione azioni inattesa';end if;
  def:=replace(def,needle,'p_action not in(''put'',''undo'',''clear'',''erase'')');
  def:=replace(def,' if p_action=''undo''then',$branch$
 if p_action='erase'then
  if jsonb_typeof(p_stroke) is distinct from 'object' or not public.valid_canvas_erasures(p_stroke->'erasures') or jsonb_array_length(p_stroke->'erasures')=0 then raise exception 'Cancellazione non valida';end if;
  select value into old_stroke from jsonb_array_elements(b.strokes)where value->>'id'=sid;
  if old_stroke is null or sid=any(b.deleted_ids) then return b;end if;
  s:=jsonb_set(old_stroke,'{erasures}',public.merge_canvas_erasures(coalesce(old_stroke->'erasures','[]'),p_stroke->'erasures'));
  if s=old_stroke then return b;end if;
  update public.canvas_current set strokes=(select jsonb_agg(case when value->>'id'=sid then s else value end)from jsonb_array_elements(strokes)),revision=revision+1,updated_at=now()where id=1 returning * into b;return b;
 end if;
 if p_action='undo'then$branch$);
  needle:=' update public.canvas_current set strokes=coalesce((select jsonb_agg(case when value->>''id''=sid then s else value end)';
  if position(needle in def)=0 then raise exception 'Salvataggio tratti inatteso';end if;
  def:=replace(def,needle,$keep$
 if jsonb_array_length(public.merge_canvas_erasures(coalesce(old_stroke->'erasures','[]'),coalesce(p_stroke->'erasures','[]')))>0 then
  s:=jsonb_set(s,'{erasures}',public.merge_canvas_erasures(coalesce(old_stroke->'erasures','[]'),coalesce(p_stroke->'erasures','[]')));
 end if;
$keep$||needle);
  execute def;
 end if;
 def:=pg_get_functiondef('public.play_partner_game(uuid,text,jsonb,integer)'::regprocedure);
 if position('valid_canvas_erasures' in def)=0 then
  needle:='   points:=points+jsonb_array_length(stroke->''points'')/2;';
  if position(needle in def)=0 then raise exception 'Validazione disegno partita inattesa';end if;
  def:=replace(def,needle,'   if not public.valid_canvas_erasures(coalesce(stroke->''erasures'',''[]'')) then raise exception ''Cancellazione non valida'';end if;'||chr(10)||needle);execute def;
 end if;
 def:=pg_get_functiondef('public.save_canvas(jsonb,text)'::regprocedure);
 if position('valid_canvas_erasures' in def)=0 then
  needle:='  points:=points+jsonb_array_length(s->''points'')/2;';
  if position(needle in def)=0 then raise exception 'Validazione galleria inattesa';end if;
  def:=replace(def,needle,'  if not public.valid_canvas_erasures(coalesce(s->''erasures'',''[]'')) then raise exception ''Cancellazione non valida'';end if;'||chr(10)||needle);execute def;
 end if;
end $migration$;
commit;
