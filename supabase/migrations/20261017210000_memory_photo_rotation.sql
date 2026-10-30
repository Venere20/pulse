begin;
create or replace function public.validate_memory_photo_settings() returns trigger language plpgsql set search_path=public as $$
declare item record;c jsonb;k text;n numeric;
begin
 if jsonb_typeof(new.memory_photo_settings) is distinct from 'object' or octet_length(new.memory_photo_settings::text)>16000 then raise exception 'Impostazioni foto non valide';end if;
 -- Older clients may remove a photo without knowing its presentation settings.
 new.memory_photo_settings:=coalesce((select jsonb_object_agg(key,value)from jsonb_each(new.memory_photo_settings)where key=any(coalesce(new.memory_photos,'{}'))),'{}');
 if (select count(*)from jsonb_each(new.memory_photo_settings))>3 then raise exception 'Massimo tre impostazioni foto';end if;
 for item in select * from jsonb_each(new.memory_photo_settings)loop
  if jsonb_typeof(item.value)<>'object' or not coalesce(item.value->>'mode' in('fixed','adaptive'),false) or jsonb_typeof(item.value->'crop')is distinct from 'object' then raise exception 'Formato foto non valido';end if;
  if item.value ? 'rotation' then
   if jsonb_typeof(item.value->'rotation')is distinct from 'number' then raise exception 'Rotazione non valida';end if;
   if (item.value->>'rotation')::numeric not in(0,90,180,270)then raise exception 'Rotazione non valida';end if;
  end if;
  c:=item.value->'crop';
  foreach k in array array['x','y','width','height']loop
   if jsonb_typeof(c->k)is distinct from 'number' then raise exception 'Ritaglio non valido';end if;
   n:=(c->>k)::numeric;
   if n<0 or n>1 or (k in('width','height')and n<0.05)then raise exception 'Ritaglio fuori dai limiti';end if;
  end loop;
  if (c->>'x')::numeric+(c->>'width')::numeric>1.000001 or (c->>'y')::numeric+(c->>'height')::numeric>1.000001 then raise exception 'Ritaglio fuori dalla fotografia';end if;
 end loop;
 return new;
end $$;
revoke all on function public.validate_memory_photo_settings()from public,anon,authenticated;
commit;

