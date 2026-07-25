create table public.resources (
	id uuid primary key default gen_random_uuid(),
	organization_id uuid not null default public.current_organization_id()
		references public.organizations (id) on delete cascade,
	-- Only 'inventory-unit' is populated by this slice (WorldView's travel
	-- packages) — 'provider' is reserved for the vet/salon-style paradigm
	-- Standards §7b sequences after this one (see ADR-0006). Not a form
	-- field yet; the insert action sets it directly.
	resource_type text not null default 'inventory-unit' check (resource_type in ('provider', 'inventory-unit')),
	name text not null,
	description text,
	departure_date date not null,
	return_date date not null check (return_date >= departure_date),
	-- Capacity is optional; null means uncapped — a pure request log with no
	-- hard ceiling ever checked (Standards §4 / bookings spec's Domain model).
	quantity integer check (quantity is null or quantity > 0),
	requires_manual_confirmation boolean not null default true,
	price_cents integer not null check (price_cents >= 0),
	status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
	created_at timestamptz not null default now()
);

alter table public.resources enable row level security;

create index resources_organization_id_idx on public.resources (organization_id);

create policy resources_select_own_organization
	on public.resources for select
	to authenticated
	using ( organization_id = public.current_organization_id() );

create policy resources_insert_own_organization
	on public.resources for insert
	to authenticated
	with check ( organization_id = public.current_organization_id() );

create policy resources_update_own_organization
	on public.resources for update
	to authenticated
	using ( organization_id = public.current_organization_id() )
	with check ( organization_id = public.current_organization_id() );

grant usage on schema public to authenticated;
grant select, insert, update on public.resources to authenticated;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.resources to service_role;
