-- Catalog Categories (#11/#17). Client-authored (ADR-0004) — unlike
-- Material Type, this is a real table, not a static registry. Exactly two
-- levels: a category with a non-null parent_id may not itself be a parent.
create table public.catalog_categories (
	id uuid primary key default gen_random_uuid(),
	organization_id uuid not null default public.current_organization_id()
		references public.organizations (id) on delete cascade,
	name text not null,
	parent_id uuid references public.catalog_categories (id) on delete cascade,
	created_at timestamptz not null default now()
);

alter table public.catalog_categories enable row level security;

create index catalog_categories_organization_id_idx on public.catalog_categories (organization_id);
create index catalog_categories_parent_id_idx on public.catalog_categories (parent_id);

-- Enforces the two-level rule structurally: a category can only be nested
-- under a TOP-LEVEL category. A category that is itself a subcategory
-- (non-null parent_id) can never be used as someone else's parent, since its
-- own parent_id (checked here as the would-be grandparent) is never null.
--
-- This function is SECURITY INVOKER (the default — deliberately not
-- DEFINER): the lookup below runs under the caller's own RLS, so a
-- parent_id belonging to another organization resolves to "no row found"
-- here, same as a genuinely nonexistent id — both must be rejected. An
-- earlier version only checked "is the found parent itself a subcategory,"
-- which treated "no visible row" the same as "found a top-level parent"
-- (both read as a null grandparent_id) and would have silently allowed a
-- category to nest under another organization's category via its id — a
-- cross-tenant reference the plain FK alone doesn't stop, since FK
-- existence checks bypass RLS.
create or replace function public.enforce_catalog_category_max_depth()
returns trigger
language plpgsql
as $$
declare
	parent_found boolean;
	grandparent_id uuid;
begin
	if new.parent_id is not null then
		select true, parent_id into parent_found, grandparent_id
		from public.catalog_categories
		where id = new.parent_id;

		if parent_found is not true then
			raise exception 'catalog_categories: parent_id must reference a category in your own organization';
		end if;

		if grandparent_id is not null then
			raise exception 'catalog_categories: parent_id must reference a top-level category (max depth is two levels)';
		end if;
	end if;

	return new;
end;
$$;

create trigger catalog_categories_max_depth_trigger
	before insert or update on public.catalog_categories
	for each row
	execute function public.enforce_catalog_category_max_depth();

-- A member can see/create/rename/delete their own organization's
-- categories — same authenticated-write model as catalog_items (regular
-- tenant data, RLS is the write boundary, no service_role indirection).
create policy catalog_categories_select_own_organization
	on public.catalog_categories for select
	to authenticated
	using ( organization_id = public.current_organization_id() );

create policy catalog_categories_insert_own_organization
	on public.catalog_categories for insert
	to authenticated
	with check ( organization_id = public.current_organization_id() );

create policy catalog_categories_update_own_organization
	on public.catalog_categories for update
	to authenticated
	using ( organization_id = public.current_organization_id() )
	with check ( organization_id = public.current_organization_id() );

create policy catalog_categories_delete_own_organization
	on public.catalog_categories for delete
	to authenticated
	using ( organization_id = public.current_organization_id() );

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.catalog_categories to authenticated;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.catalog_categories to service_role;

-- ============================================================
-- catalog_item_categories — many-to-many item <-> category tagging.
--
-- Deliberately has NO organization_id column of its own. A denormalized
-- column set only via a `with check (organization_id = current_organization_id())`
-- policy is spoofable here: foreign-key existence checks run with elevated
-- privileges and ignore RLS, so a caller could set organization_id to their
-- own org while item_id/category_id point at another organization's rows —
-- the FK would still resolve, and the policy would still pass. Scoping
-- through EXISTS against catalog_items/catalog_categories instead ties
-- visibility and writes to tables whose own organization_id is already
-- trustworthy, closing that hole structurally.
-- ============================================================
create table public.catalog_item_categories (
	id uuid primary key default gen_random_uuid(),
	item_id uuid not null references public.catalog_items (id) on delete cascade,
	category_id uuid not null references public.catalog_categories (id) on delete cascade,
	created_at timestamptz not null default now(),
	unique (item_id, category_id)
);

alter table public.catalog_item_categories enable row level security;

create index catalog_item_categories_item_id_idx on public.catalog_item_categories (item_id);
create index catalog_item_categories_category_id_idx on public.catalog_item_categories (category_id);

create policy catalog_item_categories_select_own_organization
	on public.catalog_item_categories for select
	to authenticated
	using (
		exists (
			select 1 from public.catalog_items
			where catalog_items.id = catalog_item_categories.item_id
			and catalog_items.organization_id = public.current_organization_id()
		)
	);

create policy catalog_item_categories_insert_own_organization
	on public.catalog_item_categories for insert
	to authenticated
	with check (
		exists (
			select 1 from public.catalog_items
			where catalog_items.id = catalog_item_categories.item_id
			and catalog_items.organization_id = public.current_organization_id()
		)
		and exists (
			select 1 from public.catalog_categories
			where catalog_categories.id = catalog_item_categories.category_id
			and catalog_categories.organization_id = public.current_organization_id()
		)
	);

create policy catalog_item_categories_delete_own_organization
	on public.catalog_item_categories for delete
	to authenticated
	using (
		exists (
			select 1 from public.catalog_items
			where catalog_items.id = catalog_item_categories.item_id
			and catalog_items.organization_id = public.current_organization_id()
		)
	);

grant select, insert, delete on public.catalog_item_categories to authenticated;
grant select, insert, delete on public.catalog_item_categories to service_role;
