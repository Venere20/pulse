begin;
create table public.date_proposal_wishes (
 proposal_id uuid not null references public.date_proposals(id) on delete cascade,
 bucket_item_id uuid not null references public.bucket_list(id) on delete cascade,
 primary key(proposal_id,bucket_item_id)
);
create index date_proposal_wishes_bucket on public.date_proposal_wishes(bucket_item_id);
alter table public.date_proposal_wishes enable row level security;
revoke all on public.date_proposal_wishes from public,anon,authenticated;
grant select on public.date_proposal_wishes to authenticated;
create policy proposal_wishes_read on public.date_proposal_wishes for select to authenticated using(public.is_couple_member());
insert into public.date_proposal_wishes(proposal_id,bucket_item_id)
 select id,bucket_item_id from public.date_proposals where bucket_item_id is not null on conflict do nothing;

-- Keep old Android/web clients that create a proposal from one wish compatible.
create or replace function public.link_proposal_wish()returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.bucket_item_id is not null then
  insert into public.date_proposal_wishes(proposal_id,bucket_item_id)values(new.id,new.bucket_item_id)on conflict do nothing;
 end if;
 if new.status='confirmed' and new.visit_id is not null then
  insert into public.visit_bucket_items(visit_id,bucket_item_id)
   select new.visit_id,bucket_item_id from public.date_proposal_wishes where proposal_id=new.id on conflict do nothing;
 end if;
 return new;
end $$;

create function public.set_proposal_wishes(p_proposal uuid,p_wishes uuid[])returns void
language plpgsql security definer set search_path=public as $$
declare proposal public.date_proposals; ids uuid[]:=coalesce(p_wishes,'{}'::uuid[]);
begin
 perform public.my_profile_id();
 if not public.is_couple_member()then raise exception 'Accesso non consentito';end if;
 select * into proposal from public.date_proposals where id=p_proposal for update;
 if proposal.id is null or proposal.status<>'open'then raise exception 'Puoi modificare i desideri solo di una proposta aperta';end if;
 if cardinality(ids)>20 or array_position(ids,null)is not null then raise exception 'Scegli fino a 20 desideri validi';end if;
 if exists(select 1 from unnest(ids)as wanted(wish_id) where not exists(select 1 from public.bucket_list b where b.id=wanted.wish_id
   and(not b.is_completed or exists(select 1 from public.date_proposal_wishes w where w.proposal_id=p_proposal and w.bucket_item_id=wanted.wish_id))))then
  raise exception 'Un desiderio non è più disponibile: aggiorna la selezione';
 end if;
 -- The junction table becomes authoritative after a modern-client edit.
 update public.date_proposals set bucket_item_id=null,updated_at=now()where id=p_proposal;
 delete from public.date_proposal_wishes where proposal_id=p_proposal and not(bucket_item_id=any(ids));
 insert into public.date_proposal_wishes(proposal_id,bucket_item_id)select p_proposal,id from unnest(ids)id on conflict do nothing;
end $$;

create function public.create_date_proposal_with_wishes(p_title text,p_place text,p_note text,p_options jsonb,p_wishes uuid[] default '{}')returns uuid
language plpgsql security definer set search_path=public as $$
declare proposal uuid;
begin
 proposal:=public.create_date_proposal(p_title,p_place,p_note,p_options);
 perform public.set_proposal_wishes(proposal,p_wishes);
 return proposal;
end $$;
revoke all on function public.set_proposal_wishes(uuid,uuid[]),public.create_date_proposal_with_wishes(text,text,text,jsonb,uuid[])from public,anon;
grant execute on function public.set_proposal_wishes(uuid,uuid[]),public.create_date_proposal_with_wishes(text,text,text,jsonb,uuid[])to authenticated;
alter publication supabase_realtime add table public.date_proposal_wishes;
commit;
