-- RLS test: a member can see/create/rename/delete their own organization's
-- categories, but not another organization's — including denied WRITES.
-- Also asserts the two-level depth rule (Standards §1: denied-access tests
-- must cover writes, not just reads).
begin;
select plan(11);

insert into public.organizations (id, name) values
  ('88888888-8888-8888-8888-888888888888', 'Org Eight'),
  ('99999999-9999-9999-9999-999999999998', 'Org Nine');

insert into auth.users (id, email) values
  ('88888888-aaaa-aaaa-aaaa-888888888888', 'member-eight@example.com'),
  ('99999999-bbbb-bbbb-bbbb-999999999998', 'member-nine@example.com');

insert into public.organization_members (user_id, organization_id, role, status, claimed_at) values
  ('88888888-aaaa-aaaa-aaaa-888888888888', '88888888-8888-8888-8888-888888888888', 'owner', 'active', now()),
  ('99999999-bbbb-bbbb-bbbb-999999999998', '99999999-9999-9999-9999-999999999998', 'owner', 'active', now());

insert into public.catalog_categories (id, organization_id, name, parent_id) values
  ('20000000-0000-0000-0000-000000000001', '88888888-8888-8888-8888-888888888888', 'Male', null);

-- As member-eight: can see their own organization's category.
set local role authenticated;
set local request.jwt.claims = '{"sub":"88888888-aaaa-aaaa-aaaa-888888888888","role":"authenticated"}';

select is(
  (select count(*)::int from public.catalog_categories where organization_id = '88888888-8888-8888-8888-888888888888'),
  1,
  'a member can see their own organization''s category'
);

select lives_ok(
  $$insert into public.catalog_categories (id, name, parent_id) values ('20000000-0000-0000-0000-000000000002', 'Jerseys', '20000000-0000-0000-0000-000000000001')$$,
  'a member can create a subcategory nested under their own top-level category'
);

select throws_ok(
  $$insert into public.catalog_categories (name, parent_id) values ('Too Deep', '20000000-0000-0000-0000-000000000002')$$,
  'P0001',
  'catalog_categories: parent_id must reference a top-level category (max depth is two levels)',
  'a subcategory cannot itself be used as another category''s parent (max depth enforced)'
);

select lives_ok(
  $$update public.catalog_categories set name = 'Male (renamed)' where id = '20000000-0000-0000-0000-000000000001'$$,
  'a member can rename their own organization''s category'
);

select lives_ok(
  $$delete from public.catalog_categories where id = '20000000-0000-0000-0000-000000000002'$$,
  'a member can delete their own organization''s category'
);

-- As member-nine: cannot see org-eight's category.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"99999999-bbbb-bbbb-bbbb-999999999998","role":"authenticated"}';

select is(
  (select count(*)::int from public.catalog_categories where organization_id = '88888888-8888-8888-8888-888888888888'),
  0,
  'a different organization''s member CANNOT see org-eight''s category'
);

with attempted as (
  update public.catalog_categories
  set name = 'Hijacked'
  where id = '20000000-0000-0000-0000-000000000001'
  returning id
)
select is(
  (select count(*)::int from attempted),
  0,
  'a different organization''s member CANNOT rename org-eight''s category'
);

with attempted as (
  delete from public.catalog_categories
  where id = '20000000-0000-0000-0000-000000000001'
  returning id
)
select is(
  (select count(*)::int from attempted),
  0,
  'a different organization''s member CANNOT delete org-eight''s category'
);

select throws_ok(
  $$insert into public.catalog_categories (organization_id, name) values ('88888888-8888-8888-8888-888888888888', 'Injected')$$,
  '42501',
  'new row violates row-level security policy for table "catalog_categories"',
  'a member cannot insert a category explicitly scoped to another organization'
);

-- The plain FK on parent_id would let a nonexistent-to-them, real row id
-- through (FK existence checks bypass RLS) — the trigger's own RLS-scoped
-- lookup must reject this, not silently treat "not visible to me" the same
-- as "found a top-level parent."
select throws_ok(
  $$insert into public.catalog_categories (name, parent_id) values ('Cross-org child', '20000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'catalog_categories: parent_id must reference a category in your own organization',
  'a member cannot nest a category under another organization''s category, even though that category genuinely exists'
);

reset role;
select is(
  (select name from public.catalog_categories where id = '20000000-0000-0000-0000-000000000001'),
  'Male (renamed)',
  'org-eight''s category was unaffected by the denied cross-organization attempts'
);

select * from finish();
rollback;
