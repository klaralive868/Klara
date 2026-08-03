-- Generic field_definitions system (ADR-0011), replacing the Customers-only
-- customer_field_definitions. entity_type discriminates which module a row
-- belongs to ('customer' now, 'order' next, extensible later) instead of a
-- bespoke table per module.
--
-- is_core distinguishes two different storage shapes sharing one row shape
-- and one management UI: an is_core row is a visibility toggle over a real,
-- already-existing typed column (customers.email, customers.phone) — never
-- customers.custom_fields — while a non-core row is a genuine custom field
-- whose values live in that jsonb bag, keyed by field_key. is_core rows are
-- restricted to a known whitelist per entity_type (Standards §2: whitelist,
-- not blacklist) — today just ('customer', 'email'/'phone'). Orders has no
-- whitelisted core keys at launch: every existing Orders column is
-- structurally intrinsic to what an order is, unlike email/phone, which are
-- genuinely optional business data that varies per client.
--
-- active is the soft-hide flag (Standards §5): toggling a field off stops it
-- being shown/collected going forward but never purges existing values —
-- re-enabling later restores full history. Toggling an is_core field off is
-- simpler still: the underlying column and its data are never touched at
-- all, only this row's flag.
create table public.field_definitions (
	id uuid primary key default gen_random_uuid(),
	organization_id uuid not null default public.current_organization_id()
		references public.organizations (id) on delete cascade,
	entity_type text not null check (entity_type in ('customer', 'order')),
	field_key text not null,
	label text not null,
	field_type text not null
		check (field_type in ('text', 'number', 'date', 'select', 'boolean', 'multi_select')),
	options jsonb,
	required boolean not null default false,
	display_order integer not null default 0,
	active boolean not null default true,
	is_core boolean not null default false,
	created_at timestamptz not null default now(),
	unique (organization_id, entity_type, field_key),
	-- A 'select' or 'multi_select' field is unrenderable without at least one
	-- real option — not null alone isn't enough, since '[]'::jsonb is a
	-- non-null value; every other type ignores this column.
	check (
		field_type not in ('select', 'multi_select')
		or (options is not null and jsonb_typeof(options) = 'array' and jsonb_array_length(options) > 0)
	),
	check (not is_core or (entity_type = 'customer' and field_key in ('email', 'phone')))
);

alter table public.field_definitions enable row level security;

create index field_definitions_organization_id_idx
	on public.field_definitions (organization_id);
create index field_definitions_org_entity_type_idx
	on public.field_definitions (organization_id, entity_type);

create policy field_definitions_select_own_organization
	on public.field_definitions for select
	to authenticated
	using ( organization_id = public.current_organization_id() );

create policy field_definitions_insert_own_organization
	on public.field_definitions for insert
	to authenticated
	with check ( organization_id = public.current_organization_id() );

create policy field_definitions_update_own_organization
	on public.field_definitions for update
	to authenticated
	using ( organization_id = public.current_organization_id() )
	with check ( organization_id = public.current_organization_id() );

create policy field_definitions_delete_own_organization
	on public.field_definitions for delete
	to authenticated
	using ( organization_id = public.current_organization_id() );

grant select, insert, update, delete on public.field_definitions to authenticated;
grant select, insert, update, delete on public.field_definitions to service_role;

-- Defensive: if a pre-existing customer_field_definitions row already used
-- the reserved 'email'/'phone' key, the unconditional backfill below would
-- collide with it on this table's own (organization_id, entity_type,
-- field_key) unique constraint, failing this migration outright. This
-- shouldn't be structurally possible today — 'email'/'phone' never existed
-- as flexible-field keys before this migration — but the guarantee
-- shouldn't rest on today's data staying clean forever. Renamed, not
-- dropped, so the business's own data survives under a disambiguated key
-- rather than being lost to a failed migration or (worse) a silent
-- overwrite.
update public.customer_field_definitions
set field_key = field_key || '_custom_' || substr(id::text, 1, 8)
where field_key in ('email', 'phone');

-- Migrate the real, existing customer_field_definitions rows across
-- unchanged (id/org/field_key/label/field_type/options/required/
-- display_order preserved, field_key above notwithstanding) — as of this
-- migration, exactly 2 rows in production, both Netbreakerz.
insert into public.field_definitions
	(id, organization_id, entity_type, field_key, label, field_type, options, required, display_order, active, is_core, created_at)
select
	id, organization_id, 'customer', field_key, label, field_type, options, required, display_order, true, false, created_at
from public.customer_field_definitions;

-- Backfill email/phone as active, is_core rows for every organization that
-- exists at migration time — required for correctness, not optional: today
-- email/phone are unconditionally shown for every org, so without this
-- backfill, the toggle-defaults-to-off model would silently remove those
-- columns from every live dashboard the moment this ships. Negative
-- display_order guarantees these sort before any pre-existing or future
-- custom field's default (0+) order, regardless of collisions.
-- Organizations created AFTER this migration deliberately do NOT get this
-- backfill — they start minimal (name-only), matching the new default.
insert into public.field_definitions
	(organization_id, entity_type, field_key, label, field_type, required, display_order, active, is_core)
select id, 'customer', 'email', 'Email', 'text', false, -2, true, true from public.organizations
union all
select id, 'customer', 'phone', 'Phone', 'text', false, -1, true, true from public.organizations;

-- customer_field_definitions is fully retired — field_definitions filtered
-- to entity_type = 'customer' is its sole replacement, not a second,
-- parallel path.
drop table public.customer_field_definitions;
