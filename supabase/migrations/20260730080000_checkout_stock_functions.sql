-- Atomic per-line stock decrement. `size` has no fixed column set (unlike
-- the six-column model this was originally specced against) — catalog_item_
-- stock is one row per (item_id, size), size a free-text value from the
-- item's own Material Type registry, with a single size IS NULL row for
-- sizeless items. This is keyed accordingly, not against a whitelisted
-- column list.
--
-- Atomicity comes from the UPDATE's WHERE clause being evaluated as part of
-- the same statement that writes the new value, under Postgres's row-level
-- locking — not a separate check-then-write pair. Two concurrent calls for
-- the same (item_id, size) serialize on that row: the first to commit wins,
-- the second's WHERE clause then evaluates against the already-decremented
-- value and correctly finds quantity < p_quantity.
--
-- SECURITY INVOKER (the default, explicit for clarity) — this is only ever
-- called from checkout_cart below, itself only ever called via the
-- service-role admin client, which already bypasses RLS and holds full
-- grants on catalog_item_stock. No elevated privilege is needed that isn't
-- already there (same reasoning as sync_catalog_item_stock/
-- mark_resource_image_primary, both invoker).
create or replace function public.decrement_item_stock(
	p_item_id uuid,
	p_size text,
	p_quantity int
)
returns boolean
language plpgsql
security invoker
as $$
declare
	v_row_count int;
begin
	update public.catalog_item_stock
	set quantity = quantity - p_quantity
	where item_id = p_item_id
		and size is not distinct from p_size
		and quantity >= p_quantity;

	get diagnostics v_row_count = row_count;
	return v_row_count > 0;
end;
$$;

grant execute on function public.decrement_item_stock(uuid, text, int) to service_role;

-- Cart-wide atomicity: a single plpgsql function call is one transaction,
-- so every decrement_item_stock call below plus the final orders insert
-- either all commit or all roll back together — no JS-orchestrated manual
-- rollback bookkeeping (unlike uploadImages' pattern, which only exists
-- because that operation genuinely can't be one DB statement; this one
-- can). An insufficient-stock line raises immediately, which unwinds every
-- earlier decrement in the same call along with it.
--
-- p_items shape: jsonb array of {item_id, name, size, quantity,
-- unit_price_cents} — the exact snapshot that lands in orders.items,
-- resolved server-side from real catalog data before this is ever called
-- (never trust client-supplied price/name).
create or replace function public.checkout_cart(
	p_organization_id uuid,
	p_customer_id uuid,
	p_items jsonb,
	p_payment_method text,
	p_delivery_address text,
	p_total_amount_cents int
)
returns uuid
language plpgsql
security invoker
as $$
declare
	v_item jsonb;
	v_item_id uuid;
	v_size text;
	v_quantity int;
	v_unlimited boolean;
	v_ok boolean;
	v_order_id uuid;
begin
	for v_item in select * from jsonb_array_elements(p_items) loop
		v_item_id := (v_item->>'item_id')::uuid;
		v_size := v_item->>'size';
		v_quantity := (v_item->>'quantity')::int;

		select unlimited_stock into v_unlimited
		from public.catalog_items
		where id = v_item_id;

		if not coalesce(v_unlimited, false) then
			v_ok := public.decrement_item_stock(v_item_id, v_size, v_quantity);
			if not v_ok then
				raise exception 'insufficient_stock:%:%', v_item_id, coalesce(v_size, '');
			end if;
		end if;
	end loop;

	insert into public.orders (
		organization_id, customer_id, items, payment_method,
		delivery_address, total_amount_cents, status
	)
	values (
		p_organization_id, p_customer_id, p_items, p_payment_method,
		p_delivery_address, p_total_amount_cents, 'pending'
	)
	returning id into v_order_id;

	return v_order_id;
end;
$$;

grant execute on function public.checkout_cart(uuid, uuid, jsonb, text, text, int) to service_role;
