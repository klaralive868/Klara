-- Catalog Items (clothing vertical, #11/#13). material_type references the
-- static, code-owned Material Type registry (src/lib/catalog/material-types.ts)
-- by key, not a DB table — see CONTEXT.md's "Material Type" entry and
-- docs/adr/0004-catalog-categories-client-authored.md for why that's
-- deliberately different from Categories.
--
-- Unlike organization_members/client_modules, ordinary org members write this
-- table directly (owner/manager/staff, no extra role check) — it's regular
-- tenant business data, not a security-sensitive auth flow, so RLS itself is
-- the write boundary (Standards §1) rather than routing through service_role.
create table public.catalog_items (
	id uuid primary key default gen_random_uuid(),
	organization_id uuid not null default public.current_organization_id()
		references public.organizations (id) on delete cascade,
	name text not null,
	description text,
	price_cents integer not null check (price_cents >= 0),
	material_type text not null,
	status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
	created_at timestamptz not null default now()
);

alter table public.catalog_items enable row level security;

create index catalog_items_organization_id_idx on public.catalog_items (organization_id);

-- A member can see, create, and edit their own organization's items — never
-- another organization's. Publishing (status = 'published') isn't reachable
-- yet from the app (ticket 4 adds the category-gating check), but the DB
-- itself doesn't need to enforce that gate — it's a cross-table rule better
-- suited to application logic (Standards §1, defense-in-depth).
create policy catalog_items_select_own_organization
	on public.catalog_items for select
	to authenticated
	using ( organization_id = public.current_organization_id() );

create policy catalog_items_insert_own_organization
	on public.catalog_items for insert
	to authenticated
	with check ( organization_id = public.current_organization_id() );

create policy catalog_items_update_own_organization
	on public.catalog_items for update
	to authenticated
	using ( organization_id = public.current_organization_id() )
	with check ( organization_id = public.current_organization_id() );

grant usage on schema public to authenticated;
grant select, insert, update on public.catalog_items to authenticated;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.catalog_items to service_role;
