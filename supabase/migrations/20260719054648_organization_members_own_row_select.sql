-- The existing members_select_own_organization policy only surfaces a row once
-- current_organization_id() resolves — i.e. once the caller already has an
-- ACTIVE membership. A pending member (mid invite-claim) has no active
-- membership yet, so that policy makes their own pending row invisible to
-- them — but the (protected) guard and the claim flow both need to read a
-- caller's own membership regardless of status, to decide whether they're
-- pending (-> set-password), active (-> in), or a member of nothing at all
-- (-> sign-in). This policy is additive (RLS OR-combines matching policies),
-- so it doesn't loosen what members_select_own_organization already allows.
create policy members_select_own_row
	on public.organization_members for select
	to authenticated
	using ( user_id = auth.uid() );
