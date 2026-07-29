-- getMembershipStatus (src/lib/server/membership.ts) needs to check the
-- caller's organization's status directly, not just their own membership
-- row's status — otherwise an archived org's active members keep sailing
-- through the (protected) dashboard guard, because member_select_own_row
-- (20260719054648) already lets them see their own membership row by
-- user_id regardless of current_organization_id() (which is null for them
-- now that their org is archived). That policy exists deliberately, for a
-- pending member mid invite-claim, and OR-combines with every other SELECT
-- policy on organization_members — so gating current_organization_id()
-- alone (20260730010000) never actually reaches this query.
--
-- Same reasoning as member_select_own_row, applied to organizations: let a
-- caller see the org behind ANY of their own membership rows (active or
-- pending), not just the one current_organization_id() resolves to. A
-- pending member still needs to see their (necessarily active, since it's
-- provisioned that way) org during claim — this doesn't loosen anything
-- current_organization_id()-gated policies already allow, it's additive
-- (RLS OR-combines matching policies), same as member_select_own_row was.
create policy organizations_select_via_own_membership
	on public.organizations for select
	to authenticated
	using (
		id in (
			select organization_id
			from public.organization_members
			where user_id = auth.uid()
		)
	);
