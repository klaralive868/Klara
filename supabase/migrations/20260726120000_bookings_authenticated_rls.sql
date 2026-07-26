-- Bookings #44: agent-side bookings management. The bookings table itself
-- and its service_role grant already exist (20260725140000_bookings.sql,
-- built for #43's public submission path) — this migration adds the
-- authenticated-role access an agent's dashboard needs, deferred until now.
--
-- No denormalized organization_id column on bookings — ownership is derived
-- via EXISTS against resources.organization_id, the same pattern used for
-- catalog_item_images (see that migration's comment) and the lesson
-- documented in docs/catalog-module.md: a `with check (organization_id =
-- current_organization_id())` column on the child table itself is
-- spoofable by whoever controls the insert payload, since nothing ties it
-- to the resource_id also being written. Deriving from the referenced
-- resource's own organization_id instead makes that impossible to spoof.
--
-- insert/update also require customer_id to resolve to the caller's own
-- organization — the FK on customer_id only proves the row exists, not who
-- owns it, so validating resource_id alone would let an agent attach their
-- own org's resource to a customer_id from a *different* organization,
-- creating a cross-tenant booking that joins and exposes that foreign
-- customer's name/email in the agent's own bookings views.
create policy bookings_select_own_organization
	on public.bookings for select
	to authenticated
	using (
		exists (
			select 1 from public.resources
			where resources.id = bookings.resource_id
			and resources.organization_id = public.current_organization_id()
		)
	);

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

grant usage on schema public to authenticated;
grant select, insert, update on public.bookings to authenticated;
