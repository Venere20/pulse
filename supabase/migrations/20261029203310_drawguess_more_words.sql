begin;

-- Expand only the server-side random pool. Do not expose the secret to the guesser.
-- Keep the current function body, authorization, locks and grants intact.
do $migration$
declare
  definition text := pg_get_functiondef('public.start_partner_game(text)'::regprocedure);
  old_selection text := $old$word:=(array['cuore','gatto','sole','pizza','albero','casa','fiore','treno','luna','ombrello','montagna','bicicletta','gelato','farfalla','barca','castello','stella','cane','torta','occhiali'])[1+floor(random()*20)::int];$old$;
  words text[] := array[
    -- Original 20 words.
    'cuore','gatto','sole','pizza','albero','casa','fiore','treno','luna','ombrello','montagna','bicicletta','gelato','farfalla','barca','castello','stella','cane','torta','occhiali',
    -- 200 additional drawable Italian words, without duplicates.
    'leone','tigre','elefante','giraffa','zebra','panda','koala','canguro','coniglio','riccio','scoiattolo','volpe','lupo','orso','cinghiale','ippopotamo','rinoceronte','coccodrillo','tartaruga','serpente',
    'mela','pera','banana','arancia','limone','fragola','ciliegia','anguria','ananas','uva','carota','pomodoro','zucca','melanzana','peperone','broccolo','fungo','panino','ciambella','biscotto',
    'tavolo','sedia','divano','letto','armadio','comodino','lampada','tappeto','specchio','finestra','porta','camino','forno','frigorifero','lavatrice','vasca','doccia','lavandino','scaffale','cuscino',
    'automobile','autobus','camion','trattore','motocicletta','monopattino','aeroplano','elicottero','mongolfiera','razzo','nave','sottomarino','funivia','tram','metropolitana','stazione','aeroporto','ponte','faro','semaforo',
    'nuvola','pioggia','neve','fulmine','arcobaleno','vulcano','isola','spiaggia','fiume','cascata','lago','deserto','bosco','palma','cactus','foglia','conchiglia','corallo','ghianda','girasole',
    'pallone','racchetta','canestro','altalena','scivolo','aquilone','bowling','biliardo','pattino','sci','slittino','skateboard','surf','arco','freccia','medaglia','podio','piscina','trampolino','paracadute',
    'chitarra','pianoforte','violino','tamburo','tromba','flauto','arpa','sassofono','fisarmonica','microfono','cuffie','radio','televisore','fotocamera','computer','tastiera','mouse','telefono','orologio','sveglia',
    'drago','unicorno','sirena','fata','strega','mago','pirata','cavaliere','principessa','re','regina','corona','spada','scudo','bacchetta','pozione','tesoro','forziere','robot','alieno',
    'matita','pennello','forbici','righello','quaderno','libro','zaino','valigia','cappello','guanto','sciarpa','scarpa','stivale','calzino','anello','collana','chiave','lucchetto','ombrellone','ventaglio',
    'pompiere','poliziotto','medico','cuoco','astronauta','contadino','pescatore','pittore','muratore','postino','marinaio','pilota','giardiniere','parrucchiere','fotografo','dentista','infermiere','ballerina','calciatore','pasticciere'
  ];
begin
  if cardinality(words) <> 220 or (select count(distinct word) from unnest(words) word) <> 220 then
    raise exception 'Il vocabolario deve contenere esattamente 220 parole uniche';
  end if;
  if strpos(definition, old_selection) = 0 then
    raise exception 'Selezione della parola diversa da quella prevista: controllare prima la funzione';
  end if;
  execute replace(definition, old_selection,
    format('word:=(%L::text[])[1+floor(random()*%s)::int];', words::text, cardinality(words)));
end;
$migration$;

commit;
