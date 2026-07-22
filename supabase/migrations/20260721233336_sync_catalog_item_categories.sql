-- Atomic replace-all sync for an item's category tags. A plain
-- delete-then-insert from the client is not atomic across two separate
-- requests: if the delete succeeds but the insert then fails (a transient
-- error, or an FK violation on a stale category id), the item is left with
-- zero tags — silently untagging a possibly-published item. Wrapping both
-- statements in one function call makes them a single transaction: if the
-- insert fails, the delete rolls back with it.
--
-- SECURITY INVOKER (the default, stated explicitly) — runs under the
-- caller's own RLS, so this grants no privilege beyond what the caller
-- already has via the catalog_item_categories policies themselves.
create or replace function public.sync_catalog_item_categories(
	p_item_id uuid,
	p_category_ids uuid[]
)
returns void
language plpgsql
security invoker
as $$
begin
	delete from public.catalog_item_categories where item_id = p_item_id;

	if p_category_ids is not null and array_length(p_category_ids, 1) is not null then
		insert into public.catalog_item_categories (item_id, category_id)
		select p_item_id, category_id
		from unnest(p_category_ids) as category_id;
	end if;
end;
$$;

grant execute on function public.sync_catalog_item_categories(uuid, uuid[]) to authenticated;
