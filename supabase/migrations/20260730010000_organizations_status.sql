-- Admin needs a way to shut down a client organization without destroying
-- its data (soft delete, reversible) — status text + check constraint,
-- following the same convention already used by catalog_items, customers,
-- and resources, rather than introducing a new archived_at-timestamp shape.
alter table public.organizations
	add column status text not null default 'active' check (status in ('active', 'archived'));

-- current_organization_id() is the single reused primitive behind every
-- org-scoped RLS policy in the schema (bookings, catalog, resources,
-- inquiries, client_modules, and organizations/organization_members
-- themselves). Requiring the joined organizations.status = 'active' here —
-- rather than adding an archived-org check to every route/policy that
-- currently trusts this function — means an archived org's members lose
-- RLS-scoped access everywhere at once, with no other file touched.
--
-- This does NOT affect the public-facing storefront (booking/inquiry forms):
-- those resolve the organization by slug and write via the service-role
-- client, bypassing RLS entirely, so they're unaffected by this change —
-- a deliberate scope boundary (see ADR-0009), not an oversight.
create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
	select om.organization_id
	from public.organization_members om
	join public.organizations o on o.id = om.organization_id
	where om.user_id = auth.uid()
		and om.status = 'active'
		and o.status = 'active'
	order by om.claimed_at desc
	limit 1;
$$;
