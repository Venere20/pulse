begin;
-- Keep the installed function, ACL and all reachability/ownership checks intact.
do $$ declare original text; patched text; begin
 select pg_get_functiondef('public.start_checkin_v2(text,text,integer,timestamptz,integer,text,boolean)'::regprocedure) into original;
 if position('p_departed_at>now()+interval''1 minute''' in original)=0 then raise exception 'Expected departure guard not found';end if;
 patched:=replace(original,'p_departed_at>now()+interval''1 minute''','p_departed_at>now()+interval''24 hours''');
 patched:=replace(patched,'Scegli una partenza tra le ultime 12 ore e adesso','Scegli una partenza nelle ultime 12 ore o nelle prossime 24 ore');
 execute patched;
end $$;
commit;
