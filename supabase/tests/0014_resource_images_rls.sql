-- RLS test: a member can see/tag/untag their own organization's resource
-- images, but not another organization's — including denied WRITES. Also
-- asserts the first-upload-auto-primary trigger, the atomic
-- mark_resource_image_primary RPC, the promote-next-primary-on-delete
-- trigger, and storage.objects write policies for the resource-images
-- bucket (public: true — see docs/adr/0007-resource-images-public-bucket.md
-- for why there's deliberately no SELECT policy on storage.objects at all;
-- public reads go through Storage's own public-object endpoint, not RLS).
begin;
select plan(17);

insert into public.organizations (id, name, slug) values
  ('e0000000-0000-0000-0000-00000000000e', 'Org E', 'org-e-resource-images'),
  ('f0000000-0000-0000-0000-00000000000f', 'Org F', 'org-f-resource-images');

insert into auth.users (id, email) values
  ('e1111111-1111-1111-1111-111111111111', 'member-e@example.com'),
  ('f2222222-2222-2222-2222-222222222222', 'member-f@example.com');

insert into public.organization_members (user_id, organization_id, role, status, claimed_at) values
  ('e1111111-1111-1111-1111-111111111111', 'e0000000-0000-0000-0000-00000000000e', 'owner', 'active', now()),
  ('f2222222-2222-2222-2222-222222222222', 'f0000000-0000-0000-0000-00000000000f', 'owner', 'active', now());

insert into public.resources (id, organization_id, name, departure_date, return_date, price_cents) values
  ('60000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-00000000000e', 'Org E Bali Tour', '2026-08-12', '2026-08-19', 199999);

-- As member-e: can attach an image to their own resource.
set local role authenticated;
set local request.jwt.claims = '{"sub":"e1111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok(
  $$insert into public.resource_images (id, resource_id, storage_path) values ('70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-00000000000e/60000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001.jpg')$$,
  'a member can insert an image row for their own organization''s resource'
);

select is(
  (select is_primary from public.resource_images where id = '70000000-0000-0000-0000-000000000001'),
  true,
  'the first image uploaded for a resource is auto-marked primary'
);

select lives_ok(
  $$insert into public.resource_images (id, resource_id, storage_path) values ('70000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-00000000000e/60000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000002.jpg')$$,
  'a member can insert a second image for the same resource'
);

select is(
  (select is_primary from public.resource_images where id = '70000000-0000-0000-0000-000000000002'),
  false,
  'the second image is NOT auto-marked primary — one already exists'
);

select lives_ok(
  $$select public.mark_resource_image_primary('70000000-0000-0000-0000-000000000002')$$,
  'a member can re-mark a different image primary via the atomic RPC'
);

select is(
  (select is_primary from public.resource_images where id = '70000000-0000-0000-0000-000000000001'),
  false,
  'the previously-primary image was un-marked'
);

select is(
  (select count(*)::int from public.resource_images where resource_id = '60000000-0000-0000-0000-000000000001' and is_primary),
  1,
  'exactly one image remains primary after re-marking'
);

-- Storage: a member can insert an object under their own organization_id
-- path prefix, but not under another organization's.
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('resource-images', 'e0000000-0000-0000-0000-00000000000e/60000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001.jpg')$$,
  'a member can insert a storage object under their own organization''s path prefix'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('resource-images', 'f0000000-0000-0000-0000-00000000000f/other-resource/other-image.jpg')$$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'a member cannot insert a storage object under another organization''s path prefix'
);

-- No SELECT policy exists on storage.objects for this bucket at all — public
-- reads go through Storage's own endpoint, not a raw table select under the
-- authenticated role, so even the owning member gets zero rows back here.
select is(
  (select count(*)::int from storage.objects where bucket_id = 'resource-images'),
  0,
  'no authenticated role can select resource-images storage objects directly (no SELECT policy — public reads bypass RLS via Storage''s own endpoint)'
);

-- As member-f: cannot see or write org-e's image rows.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"f2222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is(
  (select count(*)::int from public.resource_images where resource_id = '60000000-0000-0000-0000-000000000001'),
  0,
  'a different organization''s member CANNOT see org-e''s image rows'
);

select throws_ok(
  $$select public.mark_resource_image_primary('70000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'resource_images: image not found',
  'a different organization''s member cannot mark org-e''s image primary (not visible to them)'
);

with attempted as (
  delete from public.resource_images
  where id = '70000000-0000-0000-0000-000000000001'
  returning id
)
select is(
  (select count(*)::int from attempted),
  0,
  'a different organization''s member CANNOT delete org-e''s image row'
);

reset role;
select is(
  (select is_primary from public.resource_images where id = '70000000-0000-0000-0000-000000000002'),
  true,
  'org-e''s primary image is unaffected by the denied cross-organization attempts'
);

-- Deleting the current primary must not leave the resource with zero
-- primary images — the AFTER DELETE trigger should promote the oldest
-- remaining one.
set local role authenticated;
set local request.jwt.claims = '{"sub":"e1111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok(
  $$delete from public.resource_images where id = '70000000-0000-0000-0000-000000000002'$$,
  'a member can delete the current primary image'
);

select is(
  (select is_primary from public.resource_images where id = '70000000-0000-0000-0000-000000000001'),
  true,
  'deleting the primary image auto-promotes the oldest remaining image to primary'
);

select is(
  (select count(*)::int from public.resource_images where resource_id = '60000000-0000-0000-0000-000000000001' and is_primary),
  1,
  'exactly one image remains primary after the auto-promotion'
);

select * from finish();
rollback;
