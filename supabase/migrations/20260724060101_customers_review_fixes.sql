-- Follow-up to 20260724054703_customers.sql, fixing three code review
-- issues. A separate migration rather than editing the original — that
-- migration is already applied to production (Standards §1 doesn't cover
-- this directly, but the project's own history does: e.g. the images
-- promote-next-primary trigger was added as a follow-up migration, not a
-- rewrite of the original catalog_item_images migration).

-- ============================================================
-- Issue 1: the 'select'-requires-options CHECK only guarded against SQL
-- NULL — 'null'::jsonb, a JSON string/object, or an empty array all
-- satisfied it, any of which breaks a booking form expecting a non-empty
-- option list to render.
-- ============================================================
alter table public.customer_field_definitions
	drop constraint customer_field_definitions_check;

alter table public.customer_field_definitions
	add constraint customer_field_definitions_options_check
	check (
		field_type <> 'select'
		or (
			options is not null
			and jsonb_typeof(options) = 'array'
			and jsonb_array_length(options) > 0
		)
	);

-- ============================================================
-- Issue 2: set_customers_updated_at() omitted the search_path hardening
-- current_organization_id() already uses. The body is safe today (only
-- now(), resolved via pg_catalog), but a future edit that adds an
-- unqualified call would otherwise silently resolve against whatever the
-- session's search_path happens to be at trigger time.
-- ============================================================
create or replace function public.set_customers_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

-- ============================================================
-- Issue 3: customer_field_definitions rows are mutable (label renames,
-- display_order reorders, options edits are all expected) but had no
-- audit trail for when a definition last changed. Reuses the same
-- updated_at + trigger pattern as customers, generalized to take the
-- table name so it isn't a copy-pasted duplicate of
-- set_customers_updated_at() with one word changed.
-- ============================================================
alter table public.customer_field_definitions
	add column updated_at timestamptz not null default now();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

create trigger customer_field_definitions_set_updated_at
	before update on public.customer_field_definitions
	for each row
	execute function public.set_updated_at();
