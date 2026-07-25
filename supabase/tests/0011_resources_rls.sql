-- RLS test: a member can see/create/edit their own organization's resources,
-- but not another organization's — including denied WRITES, not just
-- denied reads (Standards §1).
begin;
select plan(8);

insert into public.organizations (id, name, slug) values
  ('88888888-8888-8888-8888-888888888888', 'Org Eight', 'org-eight-resources'),
  ('99999999-9999-9999-9999-999999999999', 'Org Nine', 'org-nine-resources');

insert into auth.users (id, email) values
  ('88888888-aaaa-aaaa-aaaa-888888888888', 'member-eight@example.com'),
  ('99999999-bbbb-bbbb-bbbb-999999999999', 'member-nine@example.com');

insert into public.organization_members (user_id, organization_id, role, status, claimed_at) values
  ('88888888-aaaa-aaaa-aaaa-888888888888', '88888888-8888-8888-8888-888888888888', 'owner', 'active', now()),
  ('99999999-bbbb-bbbb-bbbb-999999999999', '99999999-9999-9999-9999-999999999999', 'owner', 'active', now());

insert into public.resources (id, organization_id, name, departure_date, return_date, price_cents) values
  ('20000000-0000-0000-0000-000000000001', '88888888-8888-8888-8888-888888888888', 'Org Eight Bali Tour', '2026-08-12', '2026-08-19', 199999);

-- As member-eight: can see their own organization's resource.
set local role authenticated;
set local request.jwt.claims = '{"sub":"88888888-aaaa-aaaa-aaaa-888888888888","role":"authenticated"}';

select is(
  (select count(*)::int from public.resources where organization_id = '88888888-8888-8888-8888-888888888888'),
  1,
  'a member can see their own organization''s resource'
);

-- Inserting without an explicit organization_id relies on the column default
-- (current_organization_id()) — proves the default resolves correctly under RLS.
select lives_ok(
  $$insert into public.resources (name, departure_date, return_date, price_cents) values ('Org Eight Ski Trip', '2027-01-10', '2027-01-17', 250000)$$,
  'a member can insert a resource for their own organization (default organization_id)'
);

select is(
  (select count(*)::int from public.resources where organization_id = '88888888-8888-8888-8888-888888888888'),
  2,
  'the inserted resource is scoped to the inserting member''s own organization'
);

select lives_ok(
  $$update public.resources set name = 'Org Eight Bali Tour (renamed)' where id = '20000000-0000-0000-0000-000000000001'$$,
  'a member can update their own organization''s resource'
);

-- As member-nine: cannot see org-eight's resource.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"99999999-bbbb-bbbb-bbbb-999999999999","role":"authenticated"}';

select is(
  (select count(*)::int from public.resources where organization_id = '88888888-8888-8888-8888-888888888888'),
  0,
  'a different organization''s member CANNOT see org-eight''s resource'
);

-- An update targeting another organization's row is silently filtered by RLS
-- (0 rows affected), not an error — assert it has no effect rather than that
-- it throws. The data-modifying CTE has to be top-level (Postgres rejects one
-- nested inside a select is(...) subquery), so this assertion isn't wrapped.
with attempted as (
  update public.resources
  set name = 'Hijacked'
  where id = '20000000-0000-0000-0000-000000000001'
  returning id
)
select is(
  (select count(*)::int from attempted),
  0,
  'a different organization''s member CANNOT update org-eight''s resource'
);

select throws_ok(
  $$insert into public.resources (organization_id, name, departure_date, return_date, price_cents) values ('88888888-8888-8888-8888-888888888888', 'Injected', '2026-08-12', '2026-08-19', 1000)$$,
  '42501',
  'new row violates row-level security policy for table "resources"',
  'a member cannot insert a resource explicitly scoped to another organization'
);

reset role;
select is(
  (select name from public.resources where id = '20000000-0000-0000-0000-000000000001'),
  'Org Eight Bali Tour (renamed)',
  'org-eight''s resource was unaffected by the denied cross-organization update attempt'
);

select * from finish();
rollback;
