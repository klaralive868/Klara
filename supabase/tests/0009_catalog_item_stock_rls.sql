-- RLS test: a member can see/write their own organization's item stock
-- rows, but not another organization's — including denied WRITES. Also
-- asserts the null-size uniqueness constraint and the atomic sync RPC.
begin;
select plan(14);

insert into public.organizations (id, name) values
  ('e0000000-0000-0000-0000-00000000000e', 'Org E'),
  ('f0000000-0000-0000-0000-00000000000f', 'Org F');

insert into auth.users (id, email) values
  ('e1111111-1111-1111-1111-111111111111', 'member-e@example.com'),
  ('f2222222-2222-2222-2222-222222222222', 'member-f@example.com');

insert into public.organization_members (user_id, organization_id, role, status, claimed_at) values
  ('e1111111-1111-1111-1111-111111111111', 'e0000000-0000-0000-0000-00000000000e', 'owner', 'active', now()),
  ('f2222222-2222-2222-2222-222222222222', 'f0000000-0000-0000-0000-00000000000f', 'owner', 'active', now());

insert into public.catalog_items (id, organization_id, name, price_cents, material_type) values
  ('60000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-00000000000e', 'Org E Jersey', 5000, 'jersey');

-- As member-e: can write stock rows for their own item.
set local role authenticated;
set local request.jwt.claims = '{"sub":"e1111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok(
  $$insert into public.catalog_item_stock (item_id, size, quantity) values ('60000000-0000-0000-0000-000000000001', 'M', 5)$$,
  'a member can insert a stock row for their own organization''s item'
);

-- A second NULL-size row for the same item must be rejected — at most one
-- "sizeless" row per item.
select lives_ok(
  $$insert into public.catalog_item_stock (item_id, size, quantity) values ('60000000-0000-0000-0000-000000000001', null, 10)$$,
  'a member can insert a sizeless (NULL-size) stock row'
);

select throws_ok(
  $$insert into public.catalog_item_stock (item_id, size, quantity) values ('60000000-0000-0000-0000-000000000001', null, 20)$$,
  '23505',
  null,
  'a second NULL-size stock row for the same item is rejected (at most one sizeless row per item)'
);

select throws_ok(
  $$insert into public.catalog_item_stock (item_id, size, quantity) values ('60000000-0000-0000-0000-000000000001', 'M', 7)$$,
  '23505',
  null,
  'a second row for the same (item, size) pair is rejected'
);

-- The atomic sync RPC fully replaces the item's stock rowset.
select lives_ok(
  $$select public.sync_catalog_item_stock('60000000-0000-0000-0000-000000000001', '[{"size":"S","quantity":3},{"size":"L","quantity":4}]'::jsonb)$$,
  'a member can sync their own item''s stock via the atomic RPC'
);

select is(
  (select count(*)::int from public.catalog_item_stock where item_id = '60000000-0000-0000-0000-000000000001'),
  2,
  'the sync replaced the old rowset (M, NULL) with the new one (S, L)'
);

select is(
  (select quantity from public.catalog_item_stock where item_id = '60000000-0000-0000-0000-000000000001' and size = 'S'),
  3,
  'the synced quantity for size S is correct'
);

-- Zero/negative-quantity entries are dropped by the sync, not persisted.
select lives_ok(
  $$select public.sync_catalog_item_stock('60000000-0000-0000-0000-000000000001', '[{"size":"S","quantity":0},{"size":"XL","quantity":6}]'::jsonb)$$,
  'a member can re-sync, dropping zero-quantity entries'
);

select is(
  (select count(*)::int from public.catalog_item_stock where item_id = '60000000-0000-0000-0000-000000000001'),
  1,
  'only the positive-quantity entry (XL) was persisted — the zero-quantity one was dropped'
);

-- As member-f: cannot see or write org-e's stock rows.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"f2222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is(
  (select count(*)::int from public.catalog_item_stock where item_id = '60000000-0000-0000-0000-000000000001'),
  0,
  'a different organization''s member CANNOT see org-e''s stock rows'
);

with attempted as (
  update public.catalog_item_stock
  set quantity = 999
  where item_id = '60000000-0000-0000-0000-000000000001'
  returning id
)
select is(
  (select count(*)::int from attempted),
  0,
  'a different organization''s member CANNOT update org-e''s stock row'
);

select throws_ok(
  $$select public.sync_catalog_item_stock('60000000-0000-0000-0000-000000000001', '[{"size":"XL","quantity":999}]'::jsonb)$$,
  '42501',
  null,
  'a different organization''s member cannot sync stock for org-e''s item — the insert is denied by RLS'
);

with attempted as (
  delete from public.catalog_item_stock
  where item_id = '60000000-0000-0000-0000-000000000001'
  returning id
)
select is(
  (select count(*)::int from attempted),
  0,
  'a different organization''s member CANNOT delete org-e''s stock row'
);

reset role;
select is(
  (select quantity from public.catalog_item_stock where item_id = '60000000-0000-0000-0000-000000000001' and size = 'XL'),
  6,
  'org-e''s stock was unaffected by the denied cross-organization attempts'
);

select * from finish();
rollback;
