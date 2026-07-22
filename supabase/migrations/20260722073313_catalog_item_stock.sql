-- Catalog Item Stock (#11/#19). One row per (item, size), or a single
-- size-IS-NULL row for a sizeless Material Type.
create table public.catalog_item_stock (
	id uuid primary key default gen_random_uuid(),
	item_id uuid not null references public.catalog_items (id) on delete cascade,
	size text,
	quantity integer not null default 0 check (quantity >= 0),
	created_at timestamptz not null default now()
);

alter table public.catalog_item_stock enable row level security;

create index catalog_item_stock_item_id_idx on public.catalog_item_stock (item_id);

-- A plain `unique (item_id, size)` doesn't work for the sizeless case: NULL
-- is never equal to NULL, so a normal unique constraint would let multiple
-- size-IS-NULL rows pile up for the same item. Two partial indexes cover
-- both cases: one per size for sized entries, and separately, at most one
-- NULL-size row per item.
create unique index catalog_item_stock_item_size_unique
	on public.catalog_item_stock (item_id, size)
	where size is not null;

create unique index catalog_item_stock_item_null_size_unique
	on public.catalog_item_stock (item_id)
	where size is null;

-- Same EXISTS-against-catalog_items pattern as catalog_item_categories and
-- catalog_item_images — deliberately no denormalized organization_id column
-- (see catalog_item_categories's migration comment for why that's
-- spoofable: FK existence checks bypass RLS, so a caller could set
-- organization_id to their own org while item_id points at another
-- organization's item). This is a stronger guarantee than the ticket's
-- literal "RLS scoped via current_organization_id()" wording, applying the
-- same fix already made for the other two item-scoped tables.
create policy catalog_item_stock_select_own_organization
	on public.catalog_item_stock for select
	to authenticated
	using (
		exists (
			select 1 from public.catalog_items
			where catalog_items.id = catalog_item_stock.item_id
			and catalog_items.organization_id = public.current_organization_id()
		)
	);

create policy catalog_item_stock_insert_own_organization
	on public.catalog_item_stock for insert
	to authenticated
	with check (
		exists (
			select 1 from public.catalog_items
			where catalog_items.id = catalog_item_stock.item_id
			and catalog_items.organization_id = public.current_organization_id()
		)
	);

create policy catalog_item_stock_update_own_organization
	on public.catalog_item_stock for update
	to authenticated
	using (
		exists (
			select 1 from public.catalog_items
			where catalog_items.id = catalog_item_stock.item_id
			and catalog_items.organization_id = public.current_organization_id()
		)
	)
	with check (
		exists (
			select 1 from public.catalog_items
			where catalog_items.id = catalog_item_stock.item_id
			and catalog_items.organization_id = public.current_organization_id()
		)
	);

create policy catalog_item_stock_delete_own_organization
	on public.catalog_item_stock for delete
	to authenticated
	using (
		exists (
			select 1 from public.catalog_items
			where catalog_items.id = catalog_item_stock.item_id
			and catalog_items.organization_id = public.current_organization_id()
		)
	);

grant select, insert, update, delete on public.catalog_item_stock to authenticated;
grant select, insert, update, delete on public.catalog_item_stock to service_role;

-- Atomically replaces an item's full stock rowset — a delete-then-insert
-- from two separate client calls risks the same partial-failure gap fixed
-- for categories (see sync_catalog_item_categories): if the insert failed
-- after a bare delete had already committed, the item would be left with
-- zero stock rows. p_entries is a JSON array of {"size": string|null,
-- "quantity": number}; rows with quantity <= 0 are dropped rather than
-- persisted (a size the caller un-stocked doesn't need an empty row).
-- SECURITY INVOKER (the default): runs under the caller's own RLS, same as
-- if they'd made the calls directly.
create or replace function public.sync_catalog_item_stock(p_item_id uuid, p_entries jsonb)
returns void
language plpgsql
security invoker
as $$
begin
	delete from public.catalog_item_stock where item_id = p_item_id;

	insert into public.catalog_item_stock (item_id, size, quantity)
	select p_item_id, entry->>'size', (entry->>'quantity')::integer
	from jsonb_array_elements(p_entries) as entry
	where (entry->>'quantity')::integer > 0;
end;
$$;

grant execute on function public.sync_catalog_item_stock(uuid, jsonb) to authenticated;
