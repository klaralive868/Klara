-- Catalog Item Images (#11/#18). Private Storage bucket, no public read
-- access in this build (ADR-0005) — deferred entirely to the storefront
-- module's own future design work.
insert into storage.buckets (id, name, public)
values ('catalog-images', 'catalog-images', false)
on conflict (id) do nothing;

-- ============================================================
-- catalog_item_images
-- ============================================================
create table public.catalog_item_images (
	id uuid primary key default gen_random_uuid(),
	item_id uuid not null references public.catalog_items (id) on delete cascade,
	storage_path text not null,
	is_primary boolean not null default false,
	created_at timestamptz not null default now()
);

alter table public.catalog_item_images enable row level security;

create index catalog_item_images_item_id_idx on public.catalog_item_images (item_id);

-- Structurally guarantees at most one primary image per item.
create unique index catalog_item_images_one_primary_per_item
	on public.catalog_item_images (item_id)
	where is_primary;

-- Auto-marks the first image uploaded for an item as primary, so the common
-- single-image case needs no extra client step — and this holds regardless
-- of which client/path does the insert, not just the app's own upload
-- action. The lookup is RLS-scoped (SECURITY INVOKER, the default) but that
-- doesn't matter here: item_id is already own-org by the time this row's
-- own insert policy would allow it through.
create or replace function public.set_first_catalog_item_image_primary()
returns trigger
language plpgsql
as $$
begin
	if not exists (
		select 1 from public.catalog_item_images
		where item_id = new.item_id and is_primary
	) then
		new.is_primary := true;
	end if;
	return new;
end;
$$;

create trigger catalog_item_images_first_primary_trigger
	before insert on public.catalog_item_images
	for each row
	execute function public.set_first_catalog_item_image_primary();

-- Same EXISTS-against-catalog_items pattern as catalog_item_categories —
-- deliberately no denormalized organization_id column of its own (see that
-- table's migration comment for why a `with check (organization_id =
-- current_organization_id())` column is spoofable).
create policy catalog_item_images_select_own_organization
	on public.catalog_item_images for select
	to authenticated
	using (
		exists (
			select 1 from public.catalog_items
			where catalog_items.id = catalog_item_images.item_id
			and catalog_items.organization_id = public.current_organization_id()
		)
	);

create policy catalog_item_images_insert_own_organization
	on public.catalog_item_images for insert
	to authenticated
	with check (
		exists (
			select 1 from public.catalog_items
			where catalog_items.id = catalog_item_images.item_id
			and catalog_items.organization_id = public.current_organization_id()
		)
	);

create policy catalog_item_images_update_own_organization
	on public.catalog_item_images for update
	to authenticated
	using (
		exists (
			select 1 from public.catalog_items
			where catalog_items.id = catalog_item_images.item_id
			and catalog_items.organization_id = public.current_organization_id()
		)
	)
	with check (
		exists (
			select 1 from public.catalog_items
			where catalog_items.id = catalog_item_images.item_id
			and catalog_items.organization_id = public.current_organization_id()
		)
	);

create policy catalog_item_images_delete_own_organization
	on public.catalog_item_images for delete
	to authenticated
	using (
		exists (
			select 1 from public.catalog_items
			where catalog_items.id = catalog_item_images.item_id
			and catalog_items.organization_id = public.current_organization_id()
		)
	);

grant select, insert, update, delete on public.catalog_item_images to authenticated;
grant select, insert, update, delete on public.catalog_item_images to service_role;

-- Atomically re-marks an item's primary image: unmarks whichever image
-- (if any) currently holds it, then marks p_image_id. Two separate client
-- calls would risk a window with zero (or, if the second failed, still the
-- old) primary image — this is one transaction, so either both writes land
-- or neither does. SECURITY INVOKER (the default): the lookup and both
-- updates run under the caller's own RLS, same as if the caller had made
-- the calls directly, so an image id outside their own organization simply
-- resolves to "not found."
create or replace function public.mark_catalog_item_image_primary(p_image_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
	v_item_id uuid;
begin
	select item_id into v_item_id
	from public.catalog_item_images
	where id = p_image_id;

	if v_item_id is null then
		raise exception 'catalog_item_images: image not found';
	end if;

	update public.catalog_item_images
	set is_primary = false
	where item_id = v_item_id and is_primary = true;

	update public.catalog_item_images
	set is_primary = true
	where id = p_image_id;
end;
$$;

grant execute on function public.mark_catalog_item_image_primary(uuid) to authenticated;

-- ============================================================
-- Storage RLS — path convention {organization_id}/{item_id}/{image_id}.{ext},
-- so the first path segment is what scopes access. No select/read policy
-- for anon or public roles at all (ADR-0005 — no public read access).
-- ============================================================
create policy catalog_images_select_own_organization
	on storage.objects for select
	to authenticated
	using (
		bucket_id = 'catalog-images'
		and (storage.foldername(name))[1] = (public.current_organization_id())::text
	);

create policy catalog_images_insert_own_organization
	on storage.objects for insert
	to authenticated
	with check (
		bucket_id = 'catalog-images'
		and (storage.foldername(name))[1] = (public.current_organization_id())::text
	);

create policy catalog_images_delete_own_organization
	on storage.objects for delete
	to authenticated
	using (
		bucket_id = 'catalog-images'
		and (storage.foldername(name))[1] = (public.current_organization_id())::text
	);
