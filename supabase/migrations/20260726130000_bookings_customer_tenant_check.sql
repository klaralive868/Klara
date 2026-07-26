-- Security review of #44: bookings_insert_own_organization/
-- bookings_update_own_organization only validated resource_id's
-- organization — an authenticated agent could submit a customer_id
-- belonging to a *different* organization (the FK only checks the row
-- exists, not who owns it) alongside their own org's resource_id, creating
-- a cross-tenant booking that joins and exposes that foreign customer's
-- name/email in the agent's own bookings views. Both policies now also
-- require customer_id to resolve to the caller's own organization.
drop policy bookings_insert_own_organization on public.bookings;
drop policy bookings_update_own_organization on public.bookings;

create policy bookings_insert_own_organization
	on public.bookings for insert
	to authenticated
	with check (
		exists (
			select 1 from public.resources
			where resources.id = bookings.resource_id
			and resources.organization_id = public.current_organization_id()
		)
		and exists (
			select 1 from public.customers
			where customers.id = bookings.customer_id
			and customers.organization_id = public.current_organization_id()
		)
	);

create policy bookings_update_own_organization
	on public.bookings for update
	to authenticated
	using (
		exists (
			select 1 from public.resources
			where resources.id = bookings.resource_id
			and resources.organization_id = public.current_organization_id()
		)
	)
	with check (
		exists (
			select 1 from public.resources
			where resources.id = bookings.resource_id
			and resources.organization_id = public.current_organization_id()
		)
		and exists (
			select 1 from public.customers
			where customers.id = bookings.customer_id
			and customers.organization_id = public.current_organization_id()
		)
	);
