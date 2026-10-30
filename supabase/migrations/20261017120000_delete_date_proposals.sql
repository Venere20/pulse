begin;
-- Either member can remove a shared proposal. FK cascades remove options/votes;
-- the visit and the wish are referenced by the proposal, never its children.
create function public.delete_date_proposal(p_proposal uuid)returns void
language plpgsql security definer set search_path=public as $$
declare proposal public.date_proposals;
begin
 perform public.my_profile_id();
 if not public.is_couple_member()then raise exception 'Accesso non consentito';end if;
 if p_proposal is null then raise exception 'Proposta non valida';end if;
 select * into proposal from public.date_proposals where id=p_proposal for update;
 if proposal.id is null then return;end if;
 -- Drop alerts still waiting to be sent, keeping notifications already delivered.
 delete from public.notification_inbox i using public.feature_notifications n
  where i.id=n.id and n.url='/proposte/'||p_proposal::text and n.delivered_at is null and not n.expo_done and not n.web_done;
 delete from public.feature_notifications where url='/proposte/'||p_proposal::text and delivered_at is null;
 delete from public.date_proposals where id=p_proposal;
end $$;
revoke all on function public.delete_date_proposal(uuid)from public,anon;
grant execute on function public.delete_date_proposal(uuid)to authenticated;
commit;
