-- Catalog public checkout (ADR-0010, mirrors Bookings' public API — ADR-0008).
-- Netbreakerz needs two things a page/API pair for checkout depends on:
-- an unlimited-stock item (checkout always accepted, agent reconciles
-- manually — same "capacity never blocks" philosophy as Bookings' uncapped
-- resources), and somewhere to record what a checkout actually bought.
alter table public.catalog_items
	add column unlimited_stock boolean not null default false;

-- No denormalized organization_id on the items side of things elsewhere in
-- this schema (bookings, travel_inquiries derive tenancy via a join) — but
-- orders is the write target of a public, unauthenticated checkout flow
-- (via the service-role client, same as bookings/travel_inquiries), and
-- every dashboard read of it needs org-scoping without a join back through
-- customers first. A direct organization_id column, same shape as
-- resources/client_modules, keeps that read simple and RLS-checkable
-- directly.
create table public.orders (
	id uuid primary key default gen_random_uuid(),
	organization_id uuid not null references public.organizations (id) on delete cascade,
	customer_id uuid not null references public.customers (id) on delete cascade,
	-- Snapshot of what was actually bought at time of purchase — item_id,
	-- name, size, quantity, unit_price_cents per line. A snapshot, not a
	-- live join to catalog_items: an item's name/price can change after the
	-- order, but the order should keep showing what the customer actually
	-- paid for.
	items jsonb not null,
	payment_method text not null check (payment_method in ('bank_transfer', 'cod')),
	delivery_address text not null,
	total_amount_cents integer not null check (total_amount_cents >= 0),
	status text not null default 'pending' check (status in ('pending', 'confirmed', 'fulfilled', 'cancelled')),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

alter table public.orders enable row level security;

create index orders_organization_id_idx on public.orders (organization_id);
create index orders_customer_id_idx on public.orders (customer_id);

-- Closed-provisioning shape, same as organizations/client_modules: an order
-- is only ever created by the checkout flow via the service-role client,
-- never directly by an authenticated dashboard user — so no `insert` policy
-- for `authenticated` exists. `select`/`update` (status changes) do, scoped
-- the same way every other org-owned table is.
create policy orders_select_own_organization
	on public.orders for select
	to authenticated
	using ( organization_id = public.current_organization_id() );

create policy orders_update_own_organization
	on public.orders for update
	to authenticated
	using ( organization_id = public.current_organization_id() )
	with check ( organization_id = public.current_organization_id() );

grant usage on schema public to authenticated;
grant select, update on public.orders to authenticated;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.orders to service_role;

-- Same drop/re-add pattern as 20260728010000_customers_source_inquiry.sql —
-- a checkout-created customer needs its own source value, same reasoning as
-- 'inquiry' before it (not mislabeled as having come from a booking).
alter table public.customers drop constraint customers_source_check;
alter table public.customers add constraint customers_source_check
	check (source in ('booking', 'inquiry', 'order', 'manual', 'import'));
