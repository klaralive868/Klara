-- The first-upload-auto-primary trigger only fires on INSERT — deleting the
-- primary image left the remaining images with is_primary = false across
-- the board, so an item with images could end up with none marked primary.
-- This AFTER DELETE trigger promotes the oldest remaining image for the
-- item whenever the row that was just deleted held the primary spot.
--
-- Runs in the same transaction as the DELETE that fired it (standard
-- trigger semantics), so this is atomic with the removal — no separate
-- follow-up call needed. SECURITY INVOKER (the default): the UPDATE inside
-- runs under the same RLS-bound role that performed the DELETE, which
-- already passed that table's own RLS check for this item, so the
-- follow-up UPDATE is scoped the same way.
create or replace function public.promote_next_catalog_item_image_primary()
returns trigger
language plpgsql
as $$
begin
	if old.is_primary then
		update public.catalog_item_images
		set is_primary = true
		where id = (
			select id from public.catalog_item_images
			where item_id = old.item_id
			order by created_at asc
			limit 1
		);
	end if;

	return old;
end;
$$;

create trigger catalog_item_images_promote_next_primary_trigger
	after delete on public.catalog_item_images
	for each row
	execute function public.promote_next_catalog_item_image_primary();
