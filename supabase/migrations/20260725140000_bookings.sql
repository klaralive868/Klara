-- Bookings (ticket #43's public submission path; ticket #44 layers the
-- agent-side dashboard on top of the same table). No denormalized
-- organization_id column — ownership is derived via EXISTS against
-- resources.organization_id, the same lesson documented in
-- docs/catalog-module.md about spoofable client-supplied org columns.
--
-- This migration only creates the table and grants service_role access:
-- the public booking-submission action (#43) is the only writer for now,
-- and it goes through the service-role client (RLS bypass, resolving the
-- organization from the URL's slug server-side), never an authenticated
-- session. Authenticated-side RLS policies (the agent's bookings inbox,
-- confirm/cancel/complete) land with #44, once that ticket needs them.
create table public.bookings (
	id uuid primary key default gen_random_uuid(),
	resource_id uuid not null references public.resources (id) on delete cascade,
	customer_id uuid not null references public.customers (id) on delete cascade,
	traveler_count integer not null check (traveler_count > 0),
	notes text,
	-- Mirrors resources.departure_date/return_date's `date` type (no time
	-- component) — these are always copied from the resource's own dates,
	-- never requester-supplied, so there's no independent time-of-day to
	-- track.
	start_at date not null,
	end_at date not null check (end_at >= start_at),
	status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'completed')),
	created_at timestamptz not null default now()
);

alter table public.bookings enable row level security;

create index bookings_resource_id_idx on public.bookings (resource_id);
create index bookings_customer_id_idx on public.bookings (customer_id);

grant usage on schema public to service_role;
grant select, insert, update, delete on public.bookings to service_role;
