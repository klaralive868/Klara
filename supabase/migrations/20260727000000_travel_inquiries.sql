-- Travel Inquiries (#45/#48) — upstream of Resources/Bookings per
-- docs/bookings-travel-packages-spec.md: a customer describing a trip they
-- want with no existing resource to book against is a lead, not a booking.
--
-- No denormalized organization_id column — ownership is derived via EXISTS
-- against customers.organization_id, the same pattern used for bookings
-- (see 20260726120000_bookings_authenticated_rls.sql) and documented in
-- docs/catalog-module.md. Unlike bookings (which staged its cross-tenant
-- check as a follow-up fix after a security review), this bakes the
-- customer_id tenant check into insert/update from the start — the lesson
-- was already learned once.
create table public.travel_inquiries (
	id uuid primary key default gen_random_uuid(),
	customer_id uuid not null references public.customers (id) on delete cascade,
	trip_description text not null,
	preferred_dates text,
	-- Optional; freeform-adjacent like budget/preferred_dates, but still a
	-- count when given, so it gets the same >0 guard resources.quantity has.
	party_size integer check (party_size is null or party_size > 0),
	budget text,
	notes text,
	status text not null default 'new' check (status in ('new', 'in-progress', 'converted', 'closed')),
	created_at timestamptz not null default now()
);

alter table public.travel_inquiries enable row level security;

create index travel_inquiries_customer_id_idx on public.travel_inquiries (customer_id);

create policy travel_inquiries_select_own_organization
	on public.travel_inquiries for select
	to authenticated
	using (
		exists (
			select 1 from public.customers
			where customers.id = travel_inquiries.customer_id
			and customers.organization_id = public.current_organization_id()
		)
	);

create policy travel_inquiries_insert_own_organization
	on public.travel_inquiries for insert
	to authenticated
	with check (
		exists (
			select 1 from public.customers
			where customers.id = travel_inquiries.customer_id
			and customers.organization_id = public.current_organization_id()
		)
	);

create policy travel_inquiries_update_own_organization
	on public.travel_inquiries for update
	to authenticated
	using (
		exists (
			select 1 from public.customers
			where customers.id = travel_inquiries.customer_id
			and customers.organization_id = public.current_organization_id()
		)
	)
	with check (
		exists (
			select 1 from public.customers
			where customers.id = travel_inquiries.customer_id
			and customers.organization_id = public.current_organization_id()
		)
	);

grant usage on schema public to authenticated;
grant select, insert, update on public.travel_inquiries to authenticated;
