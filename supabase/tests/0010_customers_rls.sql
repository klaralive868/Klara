-- RLS test: a member can see/write their own organization's customers, but
-- not another organization's — including denied INSERT (spoofed
-- organization_id), UPDATE, and DELETE.
-- (customer_field_definitions RLS coverage moved to
-- 0015_field_definitions_rls.sql when that table was generalized —
-- ADR-0011.)
begin;
select plan(9);

insert into public.organizations (id, name, slug) values
  ('a0000000-0000-0000-0000-00000000000a', 'Org A', 'org-a-customers'),
  ('b0000000-0000-0000-0000-00000000000b', 'Org B', 'org-b-customers');

insert into auth.users (id, email) values
  ('a1111111-1111-1111-1111-111111111111', 'member-a@example.com'),
  ('b2222222-2222-2222-2222-222222222222', 'member-b@example.com');

insert into public.organization_members (user_id, organization_id, role, status, claimed_at) values
  ('a1111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-00000000000a', 'owner', 'active', now()),
  ('b2222222-2222-2222-2222-222222222222', 'b0000000-0000-0000-0000-00000000000b', 'owner', 'active', now());

-- ============================================================
-- customers
-- ============================================================

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok(
  $$insert into public.customers (id, full_name, email) values ('c0000000-0000-0000-0000-000000000001', 'Org A Customer', 'a-customer@example.com')$$,
  'a member can insert a customer for their own organization (organization_id defaults to it)'
);

select is(
  (select organization_id from public.customers where id = 'c0000000-0000-0000-0000-000000000001'),
  'a0000000-0000-0000-0000-00000000000a'::uuid,
  'the inserted customer defaulted to the caller''s own organization'
);

select throws_ok(
  $$insert into public.customers (id, organization_id, full_name) values ('c0000000-0000-0000-0000-000000000099', 'b0000000-0000-0000-0000-00000000000b', 'Spoofed Customer')$$,
  '42501',
  null,
  'a member cannot insert a customer with a spoofed organization_id belonging to another organization'
);

-- As member-b: cannot see, insert-into, update, or delete org-a's customers.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"b2222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is(
  (select count(*)::int from public.customers where organization_id = 'a0000000-0000-0000-0000-00000000000a'),
  0,
  'a different organization''s member CANNOT see org-a''s customers'
);

with attempted as (
  update public.customers
  set full_name = 'Hijacked'
  where id = 'c0000000-0000-0000-0000-000000000001'
  returning id
)
select is(
  (select count(*)::int from attempted),
  0,
  'a different organization''s member CANNOT update org-a''s customer'
);

with attempted as (
  delete from public.customers
  where id = 'c0000000-0000-0000-0000-000000000001'
  returning id
)
select is(
  (select count(*)::int from attempted),
  0,
  'a different organization''s member CANNOT delete org-a''s customer'
);

reset role;
select is(
  (select full_name from public.customers where id = 'c0000000-0000-0000-0000-000000000001'),
  'Org A Customer',
  'org-a''s customer was unaffected by the denied cross-organization attempts'
);

-- A member CAN update and delete their own organization's customer.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok(
  $$update public.customers set status = 'archived' where id = 'c0000000-0000-0000-0000-000000000001'$$,
  'a member can update their own organization''s customer'
);

select lives_ok(
  $$delete from public.customers where id = 'c0000000-0000-0000-0000-000000000001'$$,
  'a member can delete their own organization''s customer'
);

select * from finish();
rollback;
