begin;
create table public.canvas_current (
 id integer primary key check(id=1),epoch integer not null default 1,revision bigint not null default 0,
 strokes jsonb not null default '[]',deleted_ids text[] not null default '{}',updated_at timestamptz not null default now()
);
insert into public.canvas_current(id)values(1);
alter table public.canvas_current enable row level security;
create policy canvas_current_read on public.canvas_current for select to authenticated using(public.is_couple_member());
revoke all on public.canvas_current from anon,authenticated;
grant select on public.canvas_current to authenticated;
alter publication supabase_realtime add table public.canvas_current;

create function public.apply_canvas_board(p_epoch integer,p_action text,p_stroke jsonb default null,p_id text default null)
returns public.canvas_current language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id();b public.canvas_current;s jsonb;old_stroke jsonb;coord jsonb;sid text;total integer;
begin
 if not public.is_couple_member()then raise exception 'Accesso non consentito';end if;
 if p_action is null or p_action not in('put','undo','clear')then raise exception 'Azione non valida';end if;
 select * into b from public.canvas_current where id=1 for update;
 if p_epoch is distinct from b.epoch then return b;end if;
 if p_action='clear'then
  update public.canvas_current set epoch=epoch+1,revision=revision+1,strokes='[]',deleted_ids='{}',updated_at=now()where id=1 returning * into b;return b;
 end if;
 sid:=case when p_action='put'then p_stroke->>'id'else p_id end;
 if sid is null or length(sid)>80 or left(sid,length(me::text)+1)<>me::text||':'then raise exception 'Puoi modificare solo i tuoi tratti';end if;
 if p_action='undo'then
  if sid=any(b.deleted_ids)then return b;end if;
  if cardinality(b.deleted_ids)>=6000 then raise exception 'Pulisci la lavagna prima di continuare';end if;
  update public.canvas_current set strokes=coalesce((select jsonb_agg(value)from jsonb_array_elements(strokes)where value->>'id'<>sid),'[]'),
    deleted_ids=array_append(deleted_ids,sid),revision=revision+1,updated_at=now()where id=1 returning * into b;return b;
 end if;
 if sid=any(b.deleted_ids)then return b;end if;
 if not coalesce(jsonb_typeof(p_stroke)='object'and p_stroke->>'author'=me::text
   and p_stroke->>'color'in('#FF4D85','#FFCB47','#59CD90','#4DA3FF','#B07CFF','#FFFFFF','#282431','#FF7A59')
   and p_stroke->>'brush'in('ink','neon')and p_stroke->>'width'in('3','6','12')
   and jsonb_typeof(p_stroke->'points')='array'and coalesce(p_stroke->>'ephemeral','false')='false',false)
   then raise exception 'Tratto non valido';end if;
 if jsonb_array_length(p_stroke->'points')not between 2 and 6000 or jsonb_array_length(p_stroke->'points')%2<>0
   or octet_length(p_stroke::text)>120000 then raise exception 'Punti non validi';end if;
 for coord in select value from jsonb_array_elements(p_stroke->'points')loop
  if jsonb_typeof(coord)<>'number'or coord::text::numeric not between 0 and 1000 then raise exception 'Coordinate non valide';end if;
 end loop;
 select value into old_stroke from jsonb_array_elements(b.strokes)where value->>'id'=sid;
 if old_stroke is not null then
  if old_stroke->>'color'<>p_stroke->>'color'or old_stroke->>'brush'<>p_stroke->>'brush'or old_stroke->>'width'<>p_stroke->>'width'then raise exception 'Tratto già esistente';end if;
  if jsonb_array_length(p_stroke->'points')<jsonb_array_length(old_stroke->'points')then return b;end if;
  if exists(select 1 from jsonb_array_elements(old_stroke->'points')with ordinality a(value,n)where p_stroke->'points'->(a.n::integer-1)<>a.value)
    then raise exception 'Il tratto è cambiato';end if;
  if old_stroke->'points'=p_stroke->'points'then return b;end if;
 elsif jsonb_array_length(b.strokes)>=60 then raise exception 'Massimo 60 tratti';end if;
 select coalesce(sum(jsonb_array_length(value->'points')/2),0)into total from jsonb_array_elements(b.strokes)where value->>'id'<>sid;
 if total+jsonb_array_length(p_stroke->'points')/2>3000 then raise exception 'Massimo 3000 punti';end if;
 s:=jsonb_build_object('id',sid,'author',me,'color',p_stroke->>'color','width',(p_stroke->>'width')::integer,'brush',p_stroke->>'brush','points',p_stroke->'points','ephemeral',false);
 update public.canvas_current set strokes=coalesce((select jsonb_agg(case when value->>'id'=sid then s else value end)from jsonb_array_elements(strokes)),'[]')||case when old_stroke is null then jsonb_build_array(s)else '[]'::jsonb end,revision=revision+1,updated_at=now()where id=1 returning * into b;
 return b;
end $$;
revoke all on function public.apply_canvas_board(integer,text,jsonb,text)from public,anon;
grant execute on function public.apply_canvas_board(integer,text,jsonb,text)to authenticated;
commit;
