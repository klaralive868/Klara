-- Atomically publishes a catalog item and syncs its category tags in one
-- transaction. Previously the app made these as two separate calls (an
-- UPDATE, then the sync_catalog_item_categories RPC): if the sync failed
-- after the status UPDATE had already committed, the item was left
-- published in the DB while the page still showed it as draft (fail()
-- doesn't re-run load) — and the status UPDATE's own `where status = 'draft'`
-- precondition then made every retry 404, with no path to recover through
-- the UI. Wrapping both writes in one function means either both succeed or
-- neither does: a failure in the tag sync now rolls back the status change
-- too.
--
-- SECURITY INVOKER (the default, stated explicitly) — both the UPDATE and
-- the nested sync_catalog_item_categories call run under the caller's own
-- RLS, same as if the caller had made the two calls directly.
create or replace function public.publish_catalog_item(
	p_item_id uuid,
	p_category_ids uuid[]
)
returns boolean
language plpgsql
security invoker
as $$
declare
	v_updated_id uuid;
begin
	update public.catalog_items
	set status = 'published'
	where id = p_item_id
	and status = 'draft'
	returning id into v_updated_id;

	if v_updated_id is null then
		return false;
	end if;

	perform public.sync_catalog_item_categories(p_item_id, p_category_ids);

	return true;
end;
$$;

grant execute on function public.publish_catalog_item(uuid, uuid[]) to authenticated;
