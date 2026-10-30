begin;

-- Keep all existing crop/rotation validation, pruning, trigger and privileges.
-- Update only the per-memory layout limit; existing memories need no rewrite.
do $migration$
declare
  definition text := pg_get_functiondef('public.validate_memory_photo_settings()'::regprocedure);
  previous_limit text := $old$if (select count(*)from jsonb_each(new.memory_photo_settings))>3 then raise exception 'Massimo tre impostazioni foto';end if;$old$;
begin
  if strpos(definition, previous_limit) = 0 then
    raise exception 'Validazione delle foto diversa da quella prevista: controllare la funzione';
  end if;
  execute replace(definition, previous_limit,
    $new$if (select count(*)from jsonb_each(new.memory_photo_settings))>5 then raise exception 'Massimo cinque impostazioni foto';end if;$new$);
end;
$migration$;

commit;
