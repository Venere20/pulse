begin;
create extension if not exists pgcrypto with schema extensions;

-- Single-household vault. No direct REST, realtime, or general backup access.
create table public.giovi_vault (
 singleton boolean primary key default true check(singleton),
 password_hash text not null,
 created_by uuid not null references public.users(id) on delete cascade
);
create table public.giovi_pearls (
 id uuid primary key default gen_random_uuid(),
 vault boolean not null default true references public.giovi_vault(singleton) on delete cascade,
 content bytea not null,
 version integer not null default 1,
 updated_at timestamptz not null default now()
);
create table public.giovi_attempts (
 user_id uuid primary key references public.users(id) on delete cascade,
 failures integer not null default 0,
 blocked_until timestamptz
);
alter table public.giovi_vault enable row level security;
alter table public.giovi_pearls enable row level security;
alter table public.giovi_attempts enable row level security;
revoke all on public.giovi_vault,public.giovi_pearls,public.giovi_attempts from public,anon,authenticated;

create function public.giovi_access(p_action text,p_password text default null,p_title text default null,p_body text default null,p_id uuid default null,p_version integer default null,p_new_password text default null)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare me uuid; cfg public.giovi_vault; attempts public.giovi_attempts; item public.giovi_pearls; result jsonb; payload text; new_id uuid;
begin
 if not public.is_couple_member() then raise exception 'Accesso non consentito'; end if;
 me:=public.my_profile_id();
 if p_action='status' then return jsonb_build_object('ok',true,'configured',exists(select 1 from public.giovi_vault)); end if;
 if p_action not in('setup','open','save','delete','password') then raise exception 'Operazione non valida'; end if;
 -- Serialize setup, password changes, and edits; counters survive rejected passwords.
 perform pg_advisory_xact_lock(hashtext('pulse-giovi-vault'));
 select * into cfg from public.giovi_vault where singleton;
 insert into public.giovi_attempts(user_id)values(me)on conflict do nothing;
 select * into attempts from public.giovi_attempts where user_id=me for update;
 if attempts.blocked_until>now() then return jsonb_build_object('ok',false,'error','Troppi tentativi. Riprova tra 15 minuti.','code','locked'); end if;
 if p_action='setup' then
  if cfg.singleton is not null then return jsonb_build_object('ok',false,'error','La password è già stata impostata. Accedi con quella condivisa.','code','configured'); end if;
  if p_password is null or length(p_password)<8 or octet_length(p_password)>72 then raise exception 'Scegli una password di almeno 8 caratteri e massimo 72 byte'; end if;
  insert into public.giovi_vault(password_hash,created_by)values(crypt(p_password,gen_salt('bf',10)),me);
 else
  if cfg.singleton is null then return jsonb_build_object('ok',false,'error','Imposta prima la password condivisa.','code','unconfigured'); end if;
  if p_password is null or octet_length(p_password)>72 or crypt(p_password,cfg.password_hash) is distinct from cfg.password_hash then
   update public.giovi_attempts set failures=case when blocked_until is not null then 1 else failures+1 end,
    blocked_until=case when blocked_until is null and failures>=4 then now()+interval '15 minutes' else null end where user_id=me;
   return jsonb_build_object('ok',false,'error','Password non corretta. Dopo 5 tentativi è prevista una pausa di 15 minuti.','code','password');
  end if;
 end if;
 update public.giovi_attempts set failures=0,blocked_until=null where user_id=me;
 if p_action='save' then
  if length(trim(coalesce(p_title,'')))=0 or length(p_title)>80 or length(coalesce(p_body,''))>6000 then raise exception 'Inserisci un titolo (massimo 80 caratteri) e un testo fino a 6000 caratteri'; end if;
  payload:=jsonb_build_object('title',trim(p_title),'body',coalesce(p_body,''))::text;
  if p_id is null then
   if(select count(*)from public.giovi_pearls)>=100 then raise exception 'Puoi conservare fino a 100 perle'; end if;
   insert into public.giovi_pearls(content)values(pgp_sym_encrypt(payload,p_password,'cipher-algo=aes256'))returning id into new_id;
  else
   update public.giovi_pearls set content=pgp_sym_encrypt(payload,p_password,'cipher-algo=aes256'),version=version+1,updated_at=now() where id=p_id and version=p_version returning id into new_id;
   if new_id is null then return jsonb_build_object('ok',false,'error','Questa perla è stata modificata o eliminata. Ricarica prima di salvarla.','code','conflict'); end if;
  end if;
 elsif p_action='delete' then
  delete from public.giovi_pearls where id=p_id and version=p_version returning * into item;
  if item.id is null then return jsonb_build_object('ok',false,'error','Questa perla è cambiata. Ricarica prima di eliminarla.','code','conflict'); end if;
 elsif p_action='password' then
  if p_new_password is null or length(p_new_password)<8 or octet_length(p_new_password)>72 then raise exception 'Scegli una password di almeno 8 caratteri e massimo 72 byte'; end if;
  update public.giovi_pearls set content=pgp_sym_encrypt(pgp_sym_decrypt(content,p_password),p_new_password,'cipher-algo=aes256');
  update public.giovi_vault set password_hash=crypt(p_new_password,gen_salt('bf',10)) where singleton;
  return jsonb_build_object('ok',true);
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'version',version,'updated_at',updated_at)||pgp_sym_decrypt(content,p_password)::jsonb order by updated_at desc,id),'[]'::jsonb)into result from public.giovi_pearls;
 return jsonb_build_object('ok',true,'entries',result);
end $$;
revoke all on function public.giovi_access(text,text,text,text,uuid,integer,text)from public,anon;
grant execute on function public.giovi_access(text,text,text,text,uuid,integer,text)to authenticated;
commit;
