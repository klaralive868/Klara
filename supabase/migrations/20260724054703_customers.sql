-- Customers (CRM foundation, per docs/klara-architecture-brief-v2.md's build
-- order: Catalog -> CRM/Customers -> Calendar). A fixed core table plus a
-- registry-backed flexible-fields pattern — the same "config over
-- customization" approach already used for Catalog's Material Type registry
-- (Standards §4), except here the registry is a real per-organization table
-- (client-authored), not a static code-owned one: which extra fields a
-- vet clinic vs. a salon wants to track on a customer record varies by
-- business, unlike Material Type's fixed clothing-vertical set.
--
-- customer_field_definitions describes the *shape* of custom_fields —
-- field_key/label/type/options/required/display_order — for a booking form
-- (or any future customer form) to render dynamically. customers.custom_fields
-- itself is a plain jsonb bag keyed by field_key; there is deliberately no
-- DB-level constraint tying a given customer row's custom_fields keys to the
-- organization's current field_definitions rows (a defined field can be
-- renamed/removed over time without needing to migrate every existing
-- customer's jsonb blob) — validating custom_fields against the current
-- registry is application-layer logic, not a DB constraint (Standards §1:
-- RLS is the tenant boundary; shape validation for a flexible jsonb column
-- is not the kind of invariant RLS/CHECK constraints are for).
--
-- No booking form or field-definitions admin UI yet — this is data-layer
-- only, ahead of both.
create table public.customers (
	id uuid primary key default gen_random_uuid(),
	organization_id uuid not null default public.current_organization_id()
		references public.organizations (id) on delete cascade,
	full_name text not null,
	email text,
	phone text,
	custom_fields jsonb not null default '{}',
	source text not null default 'manual' check (source in ('booking', 'manual', 'import')),
	status text not null default 'active' check (status in ('active', 'archived')),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

alter table public.customers enable row level security;

create index customers_organization_id_idx on public.customers (organization_id);

-- Keeps updated_at honest on every write without relying on callers to set
-- it themselves — the same reasoning as any other server-maintained
-- audit column.
create or replace function public.set_customers_updated_at()
returns trigger
language plpgsql
as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

create trigger customers_set_updated_at
	before update on public.customers
	for each row
	execute function public.set_customers_updated_at();

-- Same authenticated-write model as catalog_items/catalog_categories:
-- regular tenant business data, RLS is the write boundary, no service_role
-- indirection needed. Full CRUD (unlike catalog_items, which is archive-only
-- with no delete) — a customer record created by mistake (e.g. a duplicate
-- manual entry) should be removable outright, not just archived.
create policy customers_select_own_organization
	on public.customers for select
	to authenticated
	using ( organization_id = public.current_organization_id() );

create policy customers_insert_own_organization
	on public.customers for insert
	to authenticated
	with check ( organization_id = public.current_organization_id() );

create policy customers_update_own_organization
	on public.customers for update
	to authenticated
	using ( organization_id = public.current_organization_id() )
	with check ( organization_id = public.current_organization_id() );

create policy customers_delete_own_organization
	on public.customers for delete
	to authenticated
	using ( organization_id = public.current_organization_id() );

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.customers to authenticated;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.customers to service_role;

-- ============================================================
-- customer_field_definitions — per-organization registry describing the
-- extra fields a business wants to collect on a customer (e.g. "pet_name",
-- "preferred_stylist"). Client-authored, same relationship to `customers`
-- that catalog_categories has to catalog_items: a real table, not a static
-- registry, because the set of useful fields genuinely varies per business
-- (unlike Material Type, which is fixed for the clothing vertical).
-- ============================================================
create table public.customer_field_definitions (
	id uuid primary key default gen_random_uuid(),
	organization_id uuid not null default public.current_organization_id()
		references public.organizations (id) on delete cascade,
	field_key text not null,
	label text not null,
	field_type text not null check (field_type in ('text', 'number', 'date', 'select')),
	options jsonb,
	required boolean not null default false,
	display_order integer not null default 0,
	created_at timestamptz not null default now(),
	unique (organization_id, field_key),
	-- A 'select' field is unrenderable without its option list; every other
	-- type ignores this column, so nothing else constrains it.
	check (field_type <> 'select' or options is not null)
);

alter table public.customer_field_definitions enable row level security;

create index customer_field_definitions_organization_id_idx
	on public.customer_field_definitions (organization_id);

create policy customer_field_definitions_select_own_organization
	on public.customer_field_definitions for select
	to authenticated
	using ( organization_id = public.current_organization_id() );

create policy customer_field_definitions_insert_own_organization
	on public.customer_field_definitions for insert
	to authenticated
	with check ( organization_id = public.current_organization_id() );

create policy customer_field_definitions_update_own_organization
	on public.customer_field_definitions for update
	to authenticated
	using ( organization_id = public.current_organization_id() )
	with check ( organization_id = public.current_organization_id() );

create policy customer_field_definitions_delete_own_organization
	on public.customer_field_definitions for delete
	to authenticated
	using ( organization_id = public.current_organization_id() );

grant select, insert, update, delete on public.customer_field_definitions to authenticated;
grant select, insert, update, delete on public.customer_field_definitions to service_role;
