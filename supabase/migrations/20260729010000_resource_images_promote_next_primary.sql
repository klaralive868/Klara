-- Mirrors promote_next_catalog_item_image_primary
-- (20260722082329_catalog_item_images_promote_next_primary.sql) exactly —
-- see that migration's comment for the full reasoning. Deleting the primary
-- image would otherwise leave a resource's remaining images with no primary
-- at all, since the first-upload trigger only fires on INSERT.
create or replace function public.promote_next_resource_image_primary()
returns trigger
language plpgsql
as $$
begin
	if old.is_primary then
		update public.resource_images
		set is_primary = true
		where id = (
			select id from public.resource_images
			where resource_id = old.resource_id
			order by created_at asc
			limit 1
		);
	end if;

	return old;
end;
$$;

create trigger resource_images_promote_next_primary_trigger
	after delete on public.resource_images
	for each row
	execute function public.promote_next_resource_image_primary();
