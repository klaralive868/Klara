-- RLS test: a member can see/create/edit their own organization's catalog
-- items, but not another organization's — including denied WRITES, not just
-- denied reads (Standards §1).
begin;
select plan(8);

insert into public.organizations (id, name) values
  ('66666666-6666-6666-6666-666666666666', 'Org Six'),
  ('77777777-7777-7777-7777-777777777777', 'Org Seven');

insert into auth.users (id, email) values
  ('66666666-aaaa-aaaa-aaaa-666666666666', 'member-six@example.com'),
  ('77777777-bbbb-bbbb-bbbb-777777777777', 'member-seven@example.com');

insert into public.organization_members (user_id, organization_id, role, status, claimed_at) values
  ('66666666-aaaa-aaaa-aaaa-666666666666', '66666666-6666-6666-6666-666666666666', 'owner', 'active', now()),
  ('77777777-bbbb-bbbb-bbbb-777777777777', '77777777-7777-7777-7777-777777777777', 'owner', 'active', now());

insert into public.catalog_items (id, organization_id, name, price_cents, material_type) values
  ('10000000-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666', 'Org Six Jersey', 5000, 'jersey');

-- As member-six: can see their own organization's item.
set local role authenticated;
set local request.jwt.claims = '{"sub":"66666666-aaaa-aaaa-aaaa-666666666666","role":"authenticated"}';

select is(
  (select count(*)::int from public.catalog_items where organization_id = '66666666-6666-6666-6666-666666666666'),
  1,
  'a member can see their own organization''s catalog item'
);

-- Inserting without an explicit organization_id relies on the column default
-- (current_organization_id()) — proves the default resolves correctly under RLS.
select lives_ok(
  $$insert into public.catalog_items (name, price_cents, material_type) values ('Org Six Shorts', 3000, 'shorts')$$,
  'a member can insert a catalog item for their own organization (default organization_id)'
);

select is(
  (select count(*)::int from public.catalog_items where organization_id = '66666666-6666-6666-6666-666666666666'),
  2,
  'the inserted item is scoped to the inserting member''s own organization'
);

select lives_ok(
  $$update public.catalog_items set name = 'Org Six Jersey (renamed)' where id = '10000000-0000-0000-0000-000000000001'$$,
  'a member can update their own organization''s catalog item'
);

-- As member-seven: cannot see org-six's item.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"77777777-bbbb-bbbb-bbbb-777777777777","role":"authenticated"}';

select is(
  (select count(*)::int from public.catalog_items where organization_id = '66666666-6666-6666-6666-666666666666'),
  0,
  'a different organization''s member CANNOT see org-six''s catalog item'
);

-- An update targeting another organization's row is silently filtered by RLS
-- (0 rows affected), not an error — assert it has no effect rather than that
-- it throws. The data-modifying CTE has to be top-level (Postgres rejects one
-- nested inside a select is(...) subquery), so this assertion isn't wrapped.
with attempted as (
  update public.catalog_items
  set name = 'Hijacked'
  where id = '10000000-0000-0000-0000-000000000001'
  returning id
)
select is(
  (select count(*)::int from attempted),
  0,
  'a different organization''s member CANNOT update org-six''s catalog item'
);

select throws_ok(
  $$insert into public.catalog_items (organization_id, name, price_cents, material_type) values ('66666666-6666-6666-6666-666666666666', 'Injected', 1000, 'belt')$$,
  '42501',
  'new row violates row-level security policy for table "catalog_items"',
  'a member cannot insert a catalog item explicitly scoped to another organization'
);

reset role;
select is(
  (select name from public.catalog_items where id = '10000000-0000-0000-0000-000000000001'),
  'Org Six Jersey (renamed)',
  'org-six''s item was unaffected by the denied cross-organization update attempt'
);

select * from finish();
rollback;
