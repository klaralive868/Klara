-- Resource Images (#40). Mirrors Catalog's catalog_item_images
-- (20260722065742_catalog_item_images.sql) closely — same table shape, same
-- first-upload-auto-primary trigger, same EXISTS-based RLS (no denormalized
-- organization_id column) — with one deliberate difference: this bucket is
-- public. See docs/adr/0007-resource-images-public-bucket.md for why (the
-- deferred question ADR-0005 left open for Catalog is resolved here, for
-- Bookings specifically, not retroactively for Catalog).
insert into storage.buckets (id, name, public)
values ('resource-images', 'resource-images', true)
on conflict (id) do nothing;

create table public.resource_images (
	id uuid primary key default gen_random_uuid(),
	resource_id uuid not null references public.resources (id) on delete cascade,
	storage_path text not null,
	is_primary boolean not null default false,
	created_at timestamptz not null default now()
);

alter table public.resource_images enable row level security;

create index resource_images_resource_id_idx on public.resource_images (resource_id);

-- Structurally guarantees at most one primary image per resource.
create unique index resource_images_one_primary_per_resource
	on public.resource_images (resource_id)
	where is_primary;

-- Auto-marks the first image uploaded for a resource as primary — same
-- trigger as catalog_item_images', see that migration's comment.
create or replace function public.set_first_resource_image_primary()
returns trigger
language plpgsql
as $$
begin
	if not exists (
		select 1 from public.resource_images
		where resource_id = new.resource_id and is_primary
	) then
		new.is_primary := true;
	end if;
	return new;
end;
$$;

create trigger resource_images_first_primary_trigger
	before insert on public.resource_images
	for each row
	execute function public.set_first_resource_image_primary();

-- Same EXISTS-against-resources pattern as bookings/travel_inquiries —
-- deliberately no denormalized organization_id column (docs/catalog-module.md).
create policy resource_images_select_own_organization
	on public.resource_images for select
	to authenticated
	using (
		exists (
			select 1 from public.resources
			where resources.id = resource_images.resource_id
			and resources.organization_id = public.current_organization_id()
		)
	);

create policy resource_images_insert_own_organization
	on public.resource_images for insert
	to authenticated
	with check (
		exists (
			select 1 from public.resources
			where resources.id = resource_images.resource_id
			and resources.organization_id = public.current_organization_id()
		)
	);

create policy resource_images_update_own_organization
	on public.resource_images for update
	to authenticated
	using (
		exists (
			select 1 from public.resources
			where resources.id = resource_images.resource_id
			and resources.organization_id = public.current_organization_id()
		)
	)
	with check (
		exists (
			select 1 from public.resources
			where resources.id = resource_images.resource_id
			and resources.organization_id = public.current_organization_id()
		)
	);

create policy resource_images_delete_own_organization
	on public.resource_images for delete
	to authenticated
	using (
		exists (
			select 1 from public.resources
			where resources.id = resource_images.resource_id
			and resources.organization_id = public.current_organization_id()
		)
	);

grant select, insert, update, delete on public.resource_images to authenticated;
grant select, insert, update, delete on public.resource_images to service_role;

-- Atomically re-marks a resource's primary image — same shape and same
-- SECURITY INVOKER reasoning as mark_catalog_item_image_primary (that
-- migration's comment applies verbatim here).
create or replace function public.mark_resource_image_primary(p_image_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
	v_resource_id uuid;
begin
	select resource_id into v_resource_id
	from public.resource_images
	where id = p_image_id;

	if v_resource_id is null then
		raise exception 'resource_images: image not found';
	end if;

	update public.resource_images
	set is_primary = false
	where resource_id = v_resource_id and is_primary = true;

	update public.resource_images
	set is_primary = true
	where id = p_image_id;
end;
$$;

grant execute on function public.mark_resource_image_primary(uuid) to authenticated;

-- ============================================================
-- Storage RLS — path convention {organization_id}/{resource_id}/{image_id}.
-- {ext}, matching Catalog's. Writes are still authenticated + own-org-path-
-- scoped, same as Catalog; unlike Catalog, this bucket is public (public:
-- true), so Supabase Storage serves GET/download requests through its
-- public-object endpoint without evaluating storage.objects RLS at all —
-- no explicit anon/public SELECT policy is needed or able to narrow that
-- further. What these policies actually gate is writes only.
-- ============================================================
create policy resource_images_storage_insert_own_organization
	on storage.objects for insert
	to authenticated
	with check (
		bucket_id = 'resource-images'
		and (storage.foldername(name))[1] = (public.current_organization_id())::text
	);

create policy resource_images_storage_delete_own_organization
	on storage.objects for delete
	to authenticated
	using (
		bucket_id = 'resource-images'
		and (storage.foldername(name))[1] = (public.current_organization_id())::text
	);
