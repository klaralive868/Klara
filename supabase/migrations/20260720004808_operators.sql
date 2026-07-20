-- Operator identity, standalone from organization_members (ADR-0003): a user
-- can simultaneously be a business's owner AND an operator — the two are
-- orthogonal, so this is its own table rather than an overloaded role value.
create table public.operators (
	user_id uuid primary key references auth.users (id) on delete cascade,
	created_at timestamptz not null default now()
);

alter table public.operators enable row level security;

-- A user needs to be able to check their own operator status (the (admin)
-- guard, and the dashboard's "show the Admin option" check both need this).
-- Deny-by-default otherwise: no insert/update/delete policies exist here —
-- granting operator status is a manual, one-time bootstrap step (ADR-0003),
-- never an app-driven write, so service_role is the only writer.
create policy operators_select_own
	on public.operators for select
	to authenticated
	using ( user_id = auth.uid() );

grant usage on schema public to authenticated;
grant select on public.operators to authenticated;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.operators to service_role;
