-- RLS test: a member can tag/untag their own organization's items with
-- their own organization's categories, but not another organization's rows
-- — including denied WRITES, not just denied reads.
begin;
select plan(7);

insert into public.organizations (id, name) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'Org A'),
  ('bbbbbbbb-0000-0000-0000-0000000000b1', 'Org B');

insert into auth.users (id, email) values
  ('aaaaaaaa-1111-1111-1111-111111111111', 'member-a@example.com'),
  ('bbbbbbbb-2222-2222-2222-222222222222', 'member-b@example.com');

insert into public.organization_members (user_id, organization_id, role, status, claimed_at) values
  ('aaaaaaaa-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'owner', 'active', now()),
  ('bbbbbbbb-2222-2222-2222-222222222222', 'bbbbbbbb-0000-0000-0000-0000000000b1', 'owner', 'active', now());

insert into public.catalog_items (id, organization_id, name, price_cents, material_type) values
  ('30000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'Org A Jersey', 5000, 'jersey');

insert into public.catalog_categories (id, organization_id, name, parent_id) values
  ('30000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'Jerseys', null);

-- As member-a: can tag their own item with their own category.
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok(
  $$insert into public.catalog_item_categories (item_id, category_id) values ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002')$$,
  'a member can tag their own organization''s item with their own organization''s category'
);

select is(
  (select count(*)::int from public.catalog_item_categories where item_id = '30000000-0000-0000-0000-000000000001'),
  1,
  'the tag is visible to its own organization'
);

-- As member-b: cannot see org-a's tag.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-2222-2222-2222-222222222222","role":"authenticated"}';

select is(
  (select count(*)::int from public.catalog_item_categories where item_id = '30000000-0000-0000-0000-000000000001'),
  0,
  'a different organization''s member CANNOT see org-a''s tag'
);

select throws_ok(
  $$insert into public.catalog_item_categories (item_id, category_id) values ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002')$$,
  '42501',
  'new row violates row-level security policy for table "catalog_item_categories"',
  'a member cannot tag another organization''s item — the EXISTS check against catalog_items scoped to their own org finds no match'
);

with attempted as (
  delete from public.catalog_item_categories
  where item_id = '30000000-0000-0000-0000-000000000001'
  returning id
)
select is(
  (select count(*)::int from attempted),
  0,
  'a different organization''s member CANNOT delete org-a''s tag'
);

-- Back as member-a: can untag (delete) their own tag.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok(
  $$delete from public.catalog_item_categories where item_id = '30000000-0000-0000-0000-000000000001' and category_id = '30000000-0000-0000-0000-000000000002'$$,
  'a member can untag their own organization''s item'
);

select is(
  (select count(*)::int from public.catalog_item_categories where item_id = '30000000-0000-0000-0000-000000000001'),
  0,
  'the tag is gone after untagging'
);

select * from finish();
rollback;
