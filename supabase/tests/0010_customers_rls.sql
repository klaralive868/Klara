-- RLS test: a member can see/write their own organization's customers and
-- customer_field_definitions rows, but not another organization's —
-- including denied INSERT (spoofed organization_id), UPDATE, and DELETE.
-- Also covers the customer_field_definitions unique(org, field_key)
-- constraint and the select-type-requires-options check constraint.
begin;
select plan(23);

insert into public.organizations (id, name) values
  ('a0000000-0000-0000-0000-00000000000a', 'Org A'),
  ('b0000000-0000-0000-0000-00000000000b', 'Org B');

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

-- ============================================================
-- customer_field_definitions
-- ============================================================

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok(
  $$insert into public.customer_field_definitions (id, field_key, label, field_type, display_order) values ('d0000000-0000-0000-0000-000000000001', 'pet_name', 'Pet name', 'text', 1)$$,
  'a member can insert a field definition for their own organization'
);

select is(
  (select organization_id from public.customer_field_definitions where id = 'd0000000-0000-0000-0000-000000000001'),
  'a0000000-0000-0000-0000-00000000000a'::uuid,
  'the inserted field definition defaulted to the caller''s own organization'
);

select throws_ok(
  $$insert into public.customer_field_definitions (field_key, label, field_type) values ('pet_name', 'Duplicate key', 'text')$$,
  '23505',
  null,
  'a second field definition with the same (organization_id, field_key) is rejected'
);

select throws_ok(
  $$insert into public.customer_field_definitions (field_key, label, field_type) values ('preferred_groomer', 'Preferred groomer', 'select')$$,
  '23514',
  null,
  'a select-type field definition with no options is rejected'
);

select lives_ok(
  $$insert into public.customer_field_definitions (id, field_key, label, field_type, options) values ('d0000000-0000-0000-0000-000000000002', 'preferred_groomer', 'Preferred groomer', 'select', '["Alex","Sam"]'::jsonb)$$,
  'a select-type field definition WITH options is accepted'
);

select throws_ok(
  $$insert into public.customer_field_definitions (organization_id, field_key, label, field_type) values ('b0000000-0000-0000-0000-00000000000b', 'spoofed_field', 'Spoofed', 'text')$$,
  '42501',
  null,
  'a member cannot insert a field definition with a spoofed organization_id belonging to another organization'
);

-- As member-b: cannot see, update, or delete org-a's field definitions.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"b2222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is(
  (select count(*)::int from public.customer_field_definitions where organization_id = 'a0000000-0000-0000-0000-00000000000a'),
  0,
  'a different organization''s member CANNOT see org-a''s field definitions'
);

with attempted as (
  update public.customer_field_definitions
  set label = 'Hijacked'
  where id = 'd0000000-0000-0000-0000-000000000001'
  returning id
)
select is(
  (select count(*)::int from attempted),
  0,
  'a different organization''s member CANNOT update org-a''s field definition'
);

with attempted as (
  delete from public.customer_field_definitions
  where id = 'd0000000-0000-0000-0000-000000000001'
  returning id
)
select is(
  (select count(*)::int from attempted),
  0,
  'a different organization''s member CANNOT delete org-a''s field definition'
);

-- member-b can create their own organization's field definitions,
-- independently keyed (same field_key as org-a's is fine — the unique
-- constraint is scoped per-organization, not global).
select lives_ok(
  $$insert into public.customer_field_definitions (field_key, label, field_type) values ('pet_name', 'Pet''s name', 'text')$$,
  'a different organization''s member can create their own field definition reusing the same field_key'
);

reset role;
select is(
  (select label from public.customer_field_definitions where id = 'd0000000-0000-0000-0000-000000000001'),
  'Pet name',
  'org-a''s field definition was unaffected by the denied cross-organization attempts'
);

select is(
  (select count(*)::int from public.customer_field_definitions where organization_id = 'a0000000-0000-0000-0000-00000000000a'),
  2,
  'org-a still has exactly its own two field definitions'
);

-- A member CAN update and delete their own organization's field definition.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok(
  $$update public.customer_field_definitions set display_order = 2 where id = 'd0000000-0000-0000-0000-000000000001'$$,
  'a member can update their own organization''s field definition'
);

select lives_ok(
  $$delete from public.customer_field_definitions where id = 'd0000000-0000-0000-0000-000000000001'$$,
  'a member can delete their own organization''s field definition'
);

select * from finish();
rollback;
