-- RLS test: a member can see/tag/untag their own organization's item
-- images, but not another organization's — including denied WRITES.
-- Also asserts the first-upload-auto-primary trigger and the atomic
-- mark_catalog_item_image_primary RPC, plus storage.objects policies for
-- the catalog-images bucket.
begin;
select plan(15);

insert into public.organizations (id, name) values
  ('c0000000-0000-0000-0000-00000000000c', 'Org C'),
  ('d0000000-0000-0000-0000-00000000000d', 'Org D');

insert into auth.users (id, email) values
  ('c1111111-1111-1111-1111-111111111111', 'member-c@example.com'),
  ('d2222222-2222-2222-2222-222222222222', 'member-d@example.com');

insert into public.organization_members (user_id, organization_id, role, status, claimed_at) values
  ('c1111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-00000000000c', 'owner', 'active', now()),
  ('d2222222-2222-2222-2222-222222222222', 'd0000000-0000-0000-0000-00000000000d', 'owner', 'active', now());

insert into public.catalog_items (id, organization_id, name, price_cents, material_type) values
  ('40000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000c', 'Org C Jersey', 5000, 'jersey');

-- As member-c: can tag their own item with an image.
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok(
  $$insert into public.catalog_item_images (id, item_id, storage_path) values ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000c/40000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001.jpg')$$,
  'a member can insert an image row for their own organization''s item'
);

select is(
  (select is_primary from public.catalog_item_images where id = '50000000-0000-0000-0000-000000000001'),
  true,
  'the first image uploaded for an item is auto-marked primary'
);

select lives_ok(
  $$insert into public.catalog_item_images (id, item_id, storage_path) values ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000c/40000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000002.jpg')$$,
  'a member can insert a second image for the same item'
);

select is(
  (select is_primary from public.catalog_item_images where id = '50000000-0000-0000-0000-000000000002'),
  false,
  'the second image is NOT auto-marked primary — one already exists'
);

select lives_ok(
  $$select public.mark_catalog_item_image_primary('50000000-0000-0000-0000-000000000002')$$,
  'a member can re-mark a different image primary via the atomic RPC'
);

select is(
  (select is_primary from public.catalog_item_images where id = '50000000-0000-0000-0000-000000000001'),
  false,
  'the previously-primary image was un-marked'
);

select is(
  (select is_primary from public.catalog_item_images where id = '50000000-0000-0000-0000-000000000002'),
  true,
  'the newly-marked image is now primary'
);

select is(
  (select count(*)::int from public.catalog_item_images where item_id = '40000000-0000-0000-0000-000000000001' and is_primary),
  1,
  'exactly one image remains primary after re-marking'
);

-- Storage: a member can insert/select/delete an object under their own
-- organization_id path prefix.
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('catalog-images', 'c0000000-0000-0000-0000-00000000000c/40000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001.jpg')$$,
  'a member can insert a storage object under their own organization''s path prefix'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('catalog-images', 'd0000000-0000-0000-0000-00000000000d/other-item/other-image.jpg')$$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'a member cannot insert a storage object under another organization''s path prefix'
);

-- As member-d: cannot see or write org-c's image rows.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"d2222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is(
  (select count(*)::int from public.catalog_item_images where item_id = '40000000-0000-0000-0000-000000000001'),
  0,
  'a different organization''s member CANNOT see org-c''s image rows'
);

select throws_ok(
  $$select public.mark_catalog_item_image_primary('50000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'catalog_item_images: image not found',
  'a different organization''s member cannot mark org-c''s image primary (not visible to them)'
);

with attempted as (
  delete from public.catalog_item_images
  where id = '50000000-0000-0000-0000-000000000001'
  returning id
)
select is(
  (select count(*)::int from attempted),
  0,
  'a different organization''s member CANNOT delete org-c''s image row'
);

select is(
  (select count(*)::int from storage.objects where bucket_id = 'catalog-images' and name like 'c0000000-0000-0000-0000-00000000000c/%'),
  0,
  'a different organization''s member CANNOT see org-c''s storage objects'
);

reset role;
select is(
  (select is_primary from public.catalog_item_images where id = '50000000-0000-0000-0000-000000000002'),
  true,
  'org-c''s primary image is unaffected by the denied cross-organization attempts'
);

select * from finish();
rollback;
