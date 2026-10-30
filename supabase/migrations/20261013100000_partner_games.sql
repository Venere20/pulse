begin;
-- Public match state never contains ship positions or the word to guess.
create table public.partner_games (
 id uuid primary key default gen_random_uuid(),
 game text not null check(game in ('connect4','battleship','drawguess')),
 player_a uuid not null references public.users(id), player_b uuid not null references public.users(id),
 turn uuid not null references public.users(id),
 status text not null check(status in ('setup','playing','won','draw','cancelled')),
 winner uuid references public.users(id), state jsonb not null default '{}', revision integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(player_a<>player_b), check(turn in (player_a,player_b))
);
create unique index partner_games_active on public.partner_games(game,player_a,player_b) where status in ('setup','playing');
create table public.partner_game_secrets (
 match_id uuid not null references public.partner_games(id) on delete cascade,
 user_id uuid not null references public.users(id), payload jsonb not null,
 primary key(match_id,user_id)
);
alter table public.partner_games enable row level security;
alter table public.partner_game_secrets enable row level security;
revoke all on public.partner_games,public.partner_game_secrets from public,anon,authenticated;
grant select on public.partner_games to authenticated;
create policy partner_games_read on public.partner_games for select to authenticated
 using(public.is_couple_member() and public.my_profile_id() in (player_a,player_b));
-- Secrets have no client grants and are only exposed by the filtered RPC below.

create function public.start_partner_game(p_game text) returns uuid
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id(); partner uuid; a uuid; b uuid; mid uuid; word text; drawer uuid; previous_drawer uuid;
begin
 if p_game is null or p_game not in ('connect4','battleship','drawguess') then raise exception 'Gioco non valido'; end if;
 select id into partner from public.users where id<>me order by id limit 1;
 if partner is null then raise exception 'Partner non disponibile'; end if;
 a:=least(me,partner); b:=greatest(me,partner);
 perform pg_advisory_xact_lock(hashtext(p_game||a::text));
 select id into mid from public.partner_games where game=p_game and player_a=a and player_b=b and status in ('setup','playing');
 if mid is not null then return mid; end if;
 drawer:=me;
 if p_game='drawguess' then
  select (state->>'drawer')::uuid into previous_drawer from public.partner_games where game=p_game and player_a=a and player_b=b order by created_at desc limit 1;
  if previous_drawer is not null then drawer:=case when previous_drawer=a then b else a end; end if;
 end if;
 word:=(array['cuore','gatto','sole','pizza','albero','casa','fiore','treno','luna','ombrello','montagna','bicicletta','gelato','farfalla','barca','castello','stella','cane','torta','occhiali'])[1+floor(random()*20)::int];
 insert into public.partner_games(game,player_a,player_b,turn,status,state)
 values(p_game,a,b,case when p_game='drawguess' then drawer else me end,case when p_game='battleship' then 'setup' else 'playing' end,
 case p_game when 'connect4' then jsonb_build_object('board',repeat('-',42))
 when 'battleship' then '{"ready_a":false,"ready_b":false,"shots_a":[],"shots_b":[]}'::jsonb
 else jsonb_build_object('drawer',drawer,'strokes','[]'::jsonb,'drawing_revision',0,'guesses','[]'::jsonb,'letters',length(word)) end) returning id into mid;
 if p_game='drawguess' then insert into public.partner_game_secrets values(mid,drawer,jsonb_build_object('word',word)); end if;
 perform public.queue_feature_notification(partner,'Giochiamo insieme?',case p_game when 'connect4' then 'Una partita a Forza 4 ti aspetta.' when 'battleship' then 'Posiziona la tua flotta: Battaglia navale ti aspetta.' else case when drawer=partner then 'Tocca a te disegnare: scopri la parola segreta.' else 'Il partner disegna: prova a indovinare!' end end,'partner-game','/play/'||p_game);
 return mid;
end $$;

create function public.partner_game_secret(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare me uuid:=public.my_profile_id(); result jsonb;
begin
 if not exists(select 1 from public.partner_games where id=p_id and me in(player_a,player_b)) then raise exception 'Partita non disponibile'; end if;
 select payload into result from public.partner_game_secrets where match_id=p_id and user_id=me;
 return coalesce(result,'{}'::jsonb);
end $$;

create function public.play_partner_game(p_id uuid,p_action text,p_data jsonb default '{}',p_revision integer default null) returns void
language plpgsql security definer set search_path=public as $$
declare
 me uuid:=public.my_profile_id(); m public.partner_games%rowtype; other uuid; s jsonb;
 board text; token text; pos integer; col integer; row_i integer; dx integer; dy integer; x integer; y integer; count_i integer;
 fleet jsonb; ship jsonb; cells integer[]; all_cells integer[]:='{}'; idx integer; prev integer; horizontal boolean;
 ownkey text; enemykey text; shots jsonb; enemyships jsonb; hit boolean; sunk boolean; hits integer;
 word text; guess text; strokes jsonb; stroke jsonb; point jsonb; points integer:=0;
begin
 select * into m from public.partner_games where id=p_id for update;
 if not found or me not in(m.player_a,m.player_b) then raise exception 'Partita non disponibile'; end if;
 if p_action is null or p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Azione non valida'; end if;
 other:=case when me=m.player_a then m.player_b else m.player_a end; s:=m.state;
 if p_action='cancel' then
  if m.status not in ('playing','setup') then raise exception 'Partita già conclusa'; end if;
  update public.partner_games set status='cancelled',revision=revision+1,updated_at=now() where id=p_id; return;
 end if;
 if m.status not in ('playing','setup') then raise exception 'Partita già conclusa'; end if;
 -- Fleet confirmation and guesses merge independently under the row lock.
 if p_action in ('drop','shoot') and (p_revision is null or p_revision<>m.revision) then raise exception 'La partita è cambiata: aggiorna e riprova'; end if;
 if m.game='connect4' and p_action='drop' then
  if m.turn<>me then raise exception 'Aspetta il tuo turno'; end if;
  col:=(p_data->>'column')::integer;
  if col is null or col not between 0 and 6 then raise exception 'Colonna non valida'; end if;
  board:=s->>'board'; pos:=null;
  for row_i in reverse 5..0 loop if substr(board,row_i*7+col+1,1)='-' then pos:=row_i*7+col; exit; end if; end loop;
  if pos is null then raise exception 'Colonna piena'; end if;
  token:=case when me=m.player_a then 'A' else 'B' end;
  board:=overlay(board placing token from pos+1 for 1);
  for dx in -1..1 loop for dy in -1..1 loop
   if (dx=0 and dy=0) or dx<0 or (dx=0 and dy<0) then continue; end if;
   count_i:=1;
   for idx in 1..3 loop x:=col+dx*idx; y:=pos/7+dy*idx; exit when x not between 0 and 6 or y not between 0 and 5; exit when substr(board,y*7+x+1,1)<>token; count_i:=count_i+1; end loop;
   for idx in 1..3 loop x:=col-dx*idx; y:=pos/7-dy*idx; exit when x not between 0 and 6 or y not between 0 and 5; exit when substr(board,y*7+x+1,1)<>token; count_i:=count_i+1; end loop;
   if count_i>=4 then m.status:='won'; m.winner:=me; end if;
  end loop; end loop;
  if m.status<>'won' and position('-' in board)=0 then m.status:='draw'; end if;
  s:=jsonb_build_object('board',board); m.turn:=other;
 elsif m.game='battleship' and p_action='fleet' then
  if m.status<>'setup' then raise exception 'Le flotte sono già pronte'; end if;
  ownkey:=case when me=m.player_a then 'ready_a' else 'ready_b' end;
  if (s->>ownkey)::boolean then raise exception 'Flotta già confermata'; end if;
  fleet:=p_data->'ships';
  if jsonb_typeof(fleet) is distinct from 'array' or jsonb_array_length(fleet)<>3 then raise exception 'Servono tre navi: 3, 2 e 2 caselle'; end if;
  for idx in 0..2 loop
   ship:=fleet->idx;
   if jsonb_typeof(ship) is distinct from 'array' or jsonb_array_length(ship)<>(case when idx=0 then 3 else 2 end) then raise exception 'Lunghezza nave non valida'; end if;
   select array_agg(value::integer order by value::integer) into cells from jsonb_array_elements_text(ship);
   horizontal:=cells[1]/6=cells[2]/6; prev:=cells[1];
   for pos in 1..array_length(cells,1) loop
    if cells[pos] is null or cells[pos] not between 0 and 35 or cells[pos]=any(all_cells) then raise exception 'Navi fuori griglia o sovrapposte'; end if;
    if pos>1 and (cells[pos]<>prev+(case when horizontal then 1 else 6 end) or (horizontal and cells[pos]/6<>cells[1]/6)) then raise exception 'La nave deve essere dritta e continua'; end if;
    all_cells:=array_append(all_cells,cells[pos]); prev:=cells[pos];
   end loop;
  end loop;
  insert into public.partner_game_secrets values(p_id,me,jsonb_build_object('ships',fleet));
  s:=jsonb_set(s,array[ownkey],'true');
  if (s->>'ready_a')::boolean and (s->>'ready_b')::boolean then m.status:='playing'; end if;
 elsif m.game='battleship' and p_action='shoot' then
  if m.status<>'playing' or m.turn<>me then raise exception 'Aspetta il tuo turno e che entrambe le flotte siano pronte'; end if;
  pos:=(p_data->>'cell')::integer;
  if pos is null or pos not between 0 and 35 then raise exception 'Casella non valida'; end if;
  ownkey:=case when me=m.player_a then 'shots_a' else 'shots_b' end;
  shots:=s->ownkey;
  if exists(select 1 from jsonb_array_elements(shots) v where (v->>'cell')::int=pos) then raise exception 'Hai già colpito questa casella'; end if;
  select payload->'ships' into enemyships from public.partner_game_secrets where match_id=p_id and user_id=other;
  hit:=false; sunk:=false;
  for ship in select value from jsonb_array_elements(enemyships) loop
   if ship @> jsonb_build_array(pos) then
    hit:=true;
    sunk:=not exists(select 1 from jsonb_array_elements_text(ship) v where v::int<>pos and not exists(select 1 from jsonb_array_elements(shots) shot where (shot->>'cell')::int=v::int));
   end if;
  end loop;
  shots:=shots||jsonb_build_array(jsonb_build_object('cell',pos,'hit',hit,'sunk',sunk));
  s:=jsonb_set(s,array[ownkey],shots);
  select count(*) into hits from jsonb_array_elements(shots) shot where (shot->>'hit')::boolean;
  if hits=7 then m.status:='won'; m.winner:=me; end if;
  m.turn:=other;
 elsif m.game='drawguess' and p_action='draw' then
  if me<>(s->>'drawer')::uuid then raise exception 'Solo chi disegna può modificare la lavagna'; end if;
  if (p_data->>'drawing_revision')::int is distinct from (s->>'drawing_revision')::int then raise exception 'Il disegno è cambiato: aggiorna e riprova'; end if;
  strokes:=p_data->'strokes';
  if jsonb_typeof(strokes) is distinct from 'array' or jsonb_array_length(strokes)>60 or octet_length(strokes::text)>100000 then raise exception 'Disegno troppo grande'; end if;
  for stroke in select value from jsonb_array_elements(strokes) loop
   if jsonb_typeof(stroke) is distinct from 'object' or stroke->>'author' is distinct from me::text or length(stroke->>'id') not between 1 and 80 or stroke->>'id' is null
     or stroke->>'color' is null or stroke->>'color' not in ('#FF4D85','#FFCB47','#59CD90','#4DA3FF','#B07CFF','#FFFFFF','#282431','#FF7A59')
     or stroke->>'width' is null or (stroke->>'width')::int not in(3,6,12) or stroke->>'brush' is distinct from 'ink'
     or jsonb_typeof(stroke->'points') is distinct from 'array' or jsonb_array_length(stroke->'points')<2 or jsonb_array_length(stroke->'points')%2<>0 then raise exception 'Tratto non valido'; end if;
   points:=points+jsonb_array_length(stroke->'points')/2;
   for point in select value from jsonb_array_elements(stroke->'points') loop
    if jsonb_typeof(point)<>'number' or point::text::numeric not between 0 and 1000 then raise exception 'Punto non valido'; end if;
   end loop;
  end loop;
  if points>3000 then raise exception 'Massimo 3000 punti'; end if;
  s:=jsonb_set(s,'{strokes}',strokes);
  s:=jsonb_set(s,'{drawing_revision}',to_jsonb((s->>'drawing_revision')::int+1));
 elsif m.game='drawguess' and p_action in ('guess','reveal') then
  select payload->>'word' into word from public.partner_game_secrets where match_id=p_id and user_id=(s->>'drawer')::uuid;
  if p_action='reveal' then
   if me<>(s->>'drawer')::uuid then raise exception 'Solo chi disegna può svelare la parola'; end if;
   m.status:='draw';
  else
   if me=(s->>'drawer')::uuid then raise exception 'Tocca al partner indovinare'; end if;
   guess:=lower(btrim(p_data->>'guess'));
   if guess is null or length(guess) not between 1 and 40 then raise exception 'Scrivi una parola (massimo 40 caratteri)'; end if;
   s:=jsonb_set(s,'{guesses}',(s->'guesses')||jsonb_build_array(guess));
   if guess=word then m.status:='won'; m.winner:=me;
   elsif jsonb_array_length(s->'guesses')>=8 then m.status:='draw'; end if;
  end if;
  if m.status in ('won','draw') then s:=s||jsonb_build_object('answer',word); end if;
 else raise exception 'Azione non valida per questo gioco';
 end if;
 update public.partner_games set state=s,status=m.status,winner=m.winner,turn=m.turn,revision=revision+1,updated_at=now() where id=p_id;
 if p_action not in ('draw') then
  perform public.queue_feature_notification(other,case when m.status in ('won','draw') then 'Partita conclusa' else 'Il partner ha giocato' end,
   case when m.status in ('won','draw') then 'Apri il gioco per vedere il risultato e chiedere una rivincita.' else 'Apri il gioco per continuare insieme.' end,'partner-game','/play/'||m.game);
 end if;
end $$;

revoke all on function public.start_partner_game(text),public.partner_game_secret(uuid),public.play_partner_game(uuid,text,jsonb,integer) from public,anon;
grant execute on function public.start_partner_game(text),public.partner_game_secret(uuid),public.play_partner_game(uuid,text,jsonb,integer) to authenticated;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then alter publication supabase_realtime add table public.partner_games; end if;
end $$;
commit;
