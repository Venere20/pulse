begin;
create table public.packing_defaults (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.users(id) on delete cascade,
 label text not null check(length(btrim(label)) between 1 and 60),quantity integer not null default 1 check(quantity between 1 and 99),
 category text not null default 'other' check(category in ('documents','clothes','hygiene','electronics','health','other')),created_at timestamptz not null default now()
);
create table public.packing_lists (
 id uuid primary key default gen_random_uuid(),visit_id uuid not null references public.visits(id) on delete cascade,owner_id uuid not null references public.users(id),
 created_at timestamptz not null default now(),reminded_at timestamptz,unique(visit_id,owner_id)
);
create table public.packing_items (
 id uuid primary key default gen_random_uuid(),list_id uuid not null references public.packing_lists(id) on delete cascade,
 label text not null check(length(btrim(label)) between 1 and 60),quantity integer not null default 1 check(quantity between 1 and 99),
 category text not null check(category in ('documents','clothes','hygiene','electronics','health','other')),
 source text not null default 'manual' check(source in ('manual','suggested','default')),source_key text check(length(source_key)<=80),
 checked boolean not null default false,dismissed boolean not null default false,created_at timestamptz not null default now(),unique(list_id,source_key)
);
-- No item labels, categories, keys or list UUID are present in the shared data.
create table public.packing_progress (
 visit_id uuid not null,owner_id uuid not null,checked integer not null,total integer not null,updated_at timestamptz not null default now(),primary key(visit_id,owner_id),
 foreign key(visit_id,owner_id) references public.packing_lists(visit_id,owner_id) on delete cascade
);
alter table public.packing_defaults enable row level security;
alter table public.packing_lists enable row level security;
alter table public.packing_items enable row level security;
alter table public.packing_progress enable row level security;
create policy defaults_read on public.packing_defaults for select to authenticated using(owner_id=public.my_profile_id());
create policy lists_read on public.packing_lists for select to authenticated using(owner_id=public.my_profile_id());
create policy items_read on public.packing_items for select to authenticated using(exists(select 1 from public.packing_lists l where l.id=list_id and l.owner_id=public.my_profile_id()));
create policy progress_read on public.packing_progress for select to authenticated using(public.is_couple_member());
revoke all on public.packing_defaults,public.packing_lists,public.packing_items,public.packing_progress from anon,authenticated;
grant select on public.packing_defaults,public.packing_lists,public.packing_items,public.packing_progress to authenticated;
alter publication supabase_realtime add table public.packing_defaults,public.packing_items,public.packing_progress;
create or replace function public.update_packing_progress() returns trigger
language plpgsql security definer set search_path=public as $$
declare lid uuid:=case when tg_op='DELETE' then old.list_id else new.list_id end; l public.packing_lists;
begin
 select * into l from public.packing_lists where id=lid;
 if l.id is not null then insert into public.packing_progress(visit_id,owner_id,checked,total)
 select l.visit_id,l.owner_id,count(*)filter(where checked and not dismissed),count(*)filter(where not dismissed)from public.packing_items where list_id=lid
 on conflict(visit_id,owner_id)do update set checked=excluded.checked,total=excluded.total,updated_at=now();end if;
 return null;
end $$;
revoke all on function public.update_packing_progress() from public,anon,authenticated;
create trigger packing_progress_change after insert or update or delete on public.packing_items for each row execute function public.update_packing_progress();
create or replace function public.open_packing_list(p_visit uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id(); lid uuid; added boolean;
begin
 perform pg_advisory_xact_lock(hashtext('packing-'||p_visit||me));
 if not exists(select 1 from public.visits where id=p_visit and (end_date at time zone 'UTC')::date>=(now() at time zone 'Europe/Rome')::date and coalesce(status,'planned')<>'concluded') then raise exception 'Incontro concluso o non disponibile'; end if;
 select id into lid from public.packing_lists where visit_id=p_visit and owner_id=me;
 if lid is null then
  insert into public.packing_lists(visit_id,owner_id)values(p_visit,me)returning id into lid;
  insert into public.packing_progress(visit_id,owner_id,checked,total)values(p_visit,me,0,0);
  insert into public.packing_items(list_id,label,quantity,category,source,source_key)select lid,label,quantity,category,'default','default-'||id from public.packing_defaults where owner_id=me;
 end if;return lid;
end $$;
create or replace function public.packing_item_action(p_list uuid,p_action text,p_item uuid default null,p_data jsonb default '{}') returns void
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id(); l public.packing_lists; item public.packing_items; skey text;
begin
 select * into l from public.packing_lists where id=p_list for update;
 if l.owner_id is distinct from me then raise exception 'Questa valigia è privata'; end if;
 if p_action in ('add','dismiss') then
  skey:=nullif(p_data->>'source_key','');
  if skey is not null and exists(select 1 from public.packing_items where list_id=p_list and source_key=skey) then return; end if;
  if p_action='add' and (select count(*)from public.packing_items where list_id=p_list and not dismissed)>=80 then raise exception 'Massimo 80 elementi'; end if;
  if (select count(*)from public.packing_items where list_id=p_list)>=160 then raise exception 'Limite elementi e suggerimenti raggiunto'; end if;
  insert into public.packing_items(list_id,label,quantity,category,source,source_key,dismissed)values(p_list,btrim(p_data->>'label'),coalesce((p_data->>'quantity')::integer,1),coalesce(p_data->>'category','other'),coalesce(p_data->>'source','manual'),skey,p_action='dismiss');
 elsif p_action in ('check','edit','remove') then
  select * into item from public.packing_items where id=p_item and list_id=p_list;
  if item.id is null then raise exception 'Elemento non trovato'; end if;
  if p_action='check' then
   if p_data->>'checked' is null then raise exception 'Valore richiesto'; end if;
   update public.packing_items set checked=(p_data->>'checked')::boolean where id=p_item;
  elsif p_action='edit' then update public.packing_items set label=btrim(p_data->>'label'),quantity=(p_data->>'quantity')::integer,category=p_data->>'category'where id=p_item;
  elsif item.source_key is null then delete from public.packing_items where id=p_item;
  else update public.packing_items set dismissed=true where id=p_item; end if;
 else raise exception 'Azione non valida'; end if;
end $$;
create or replace function public.packing_default_action(p_action text,p_id uuid default null,p_data jsonb default '{}') returns void
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id();
begin
 perform pg_advisory_xact_lock(hashtext('packing-default-'||me));
 if p_action='remove' then delete from public.packing_defaults where id=p_id and owner_id=me;
 elsif p_action='add' then
  if(select count(*)from public.packing_defaults where owner_id=me)>=80 then raise exception 'Massimo 80 elementi abituali';end if;
  insert into public.packing_defaults(owner_id,label,quantity,category)values(me,btrim(p_data->>'label'),coalesce((p_data->>'quantity')::integer,1),coalesce(p_data->>'category','other'));
 else raise exception 'Azione non valida';end if;
end $$;

create table public.canvas_drawings (
 id uuid primary key default gen_random_uuid(),created_by uuid not null references public.users(id),caption text check(length(caption)<=120),
 strokes jsonb not null check(jsonb_typeof(strokes)='array' and jsonb_array_length(strokes)<=60 and octet_length(strokes::text)<=120000),created_at timestamptz not null default now()
);
alter table public.canvas_drawings enable row level security;
create policy drawings_read on public.canvas_drawings for select to authenticated using(public.is_couple_member());
revoke all on public.canvas_drawings from anon,authenticated;
grant select on public.canvas_drawings to authenticated;
alter publication supabase_realtime add table public.canvas_drawings;
create or replace function public.save_canvas(p_strokes jsonb,p_caption text default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id(); s jsonb; coord jsonb; points integer:=0; did uuid;
begin
 perform pg_advisory_xact_lock(hashtext('pulse-canvas'));
 if (select count(*)from public.canvas_drawings)>=100 then raise exception 'Massimo 100 disegni: elimina un disegno dalla galleria';end if;
 if p_strokes is null or jsonb_typeof(p_strokes)<>'array' or jsonb_array_length(p_strokes) not between 1 and 60 or octet_length(p_strokes::text)>120000 then raise exception 'Disegno non valido'; end if;
 for s in select value from jsonb_array_elements(p_strokes) loop
  if not coalesce(s->>'color' in ('#FF4D85','#FFCB47','#59CD90','#4DA3FF','#B07CFF','#FFFFFF','#282431','#FF7A59') and s->>'brush' in ('ink','neon') and s->>'width' in ('3','6','12') and length(s->>'id') between 1 and 80,false)then raise exception 'Tratto non valido';end if;
  if not coalesce(jsonb_typeof(s->'points')='array' and jsonb_array_length(s->'points')>=2 and jsonb_array_length(s->'points')%2=0,false)then raise exception 'Punti non validi';end if;
  points:=points+jsonb_array_length(s->'points')/2;
  for coord in select value from jsonb_array_elements(s->'points')loop if jsonb_typeof(coord)<>'number' or coord::text::numeric not between 0 and 1000 then raise exception 'Coordinate non valide';end if;end loop;
 end loop;
 if points>3000 then raise exception 'Massimo 3000 punti';end if;
 insert into public.canvas_drawings(created_by,caption,strokes)values(me,nullif(btrim(p_caption),''),p_strokes)returning id into did;
 if not exists(select 1 from public.feature_notifications where tag='canvas-saved'and user_id=public.partner_profile_id()and created_at>now()-interval'15 minutes')then
  perform public.queue_feature_notification(public.partner_profile_id(),'🎨 Un disegno per te','Il partner ha lasciato un disegno nella galleria.','canvas-saved','/canvas');
 end if;
 return did;
end $$;
create or replace function public.delete_canvas(p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin perform public.my_profile_id();delete from public.canvas_drawings where id=p_id;end $$;
create or replace function public.notify_canvas_started() returns void
language plpgsql security definer set search_path=public as $$
declare me uuid:=public.my_profile_id();
begin
 perform pg_advisory_xact_lock(hashtext('canvas-notify-'||me));
 if not exists(select 1 from public.feature_notifications where tag='canvas' and user_id=public.partner_profile_id() and created_at>now()-interval '15 minutes')then
 perform public.queue_feature_notification(public.partner_profile_id(),'🎨 Disegniamo insieme?','Il partner ha aperto la lavagna.','canvas','/canvas');end if;
end $$;
-- A private Realtime topic authenticated by the same household membership.
create policy pulse_canvas_read on realtime.messages for select to authenticated using(public.is_couple_member() and realtime.topic()='canvas:couple');
create policy pulse_canvas_write on realtime.messages for insert to authenticated with check(public.is_couple_member() and realtime.topic()='canvas:couple');
do $$declare f record;begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname in('open_packing_list','packing_item_action','packing_default_action','save_canvas','delete_canvas','notify_canvas_started')loop
 execute format('revoke all on function %s from public,anon',f.signature);execute format('grant execute on function %s to authenticated',f.signature);end loop;
end $$;
commit;
