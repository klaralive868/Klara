-- RLS test: a member can see/write their own organization's
-- field_definitions rows, but not another organization's — including
-- denied INSERT (spoofed organization_id), UPDATE, and DELETE. Also covers
-- the generalized (organization_id, entity_type, field_key) unique
-- constraint, the select/multi_select-requires-options check, and the
-- is_core whitelist check (ADR-0011: replaces the old, Customers-only
-- customer_field_definitions table).
begin;
select plan(20);

insert into public.organizations (id, name, slug) values
  ('a0000000-0000-0000-0000-00000000000a', 'Org A', 'org-a-fields'),
  ('b0000000-0000-0000-0000-00000000000b', 'Org B', 'org-b-fields');

insert into auth.users (id, email) values
  ('a1111111-1111-1111-1111-111111111111', 'member-a@example.com'),
  ('b2222222-2222-2222-2222-222222222222', 'member-b@example.com');

insert into public.organization_members (user_id, organization_id, role, status, claimed_at) values
  ('a1111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-00000000000a', 'owner', 'active', now()),
  ('b2222222-2222-2222-2222-222222222222', 'b0000000-0000-0000-0000-00000000000b', 'owner', 'active', now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok(
  $$insert into public.field_definitions (id, entity_type, field_key, label, field_type, display_order) values ('d0000000-0000-0000-0000-000000000001', 'customer', 'pet_name', 'Pet name', 'text', 1)$$,
  'a member can insert a field definition for their own organization'
);

select is(
  (select organization_id from public.field_definitions where id = 'd0000000-0000-0000-0000-000000000001'),
  'a0000000-0000-0000-0000-00000000000a'::uuid,
  'the inserted field definition defaulted to the caller''s own organization'
);

select throws_ok(
  $$insert into public.field_definitions (entity_type, field_key, label, field_type) values ('customer', 'pet_name', 'Duplicate key', 'text')$$,
  '23505',
  null,
  'a second field definition with the same (organization_id, entity_type, field_key) is rejected'
);

select lives_ok(
  $$insert into public.field_definitions (entity_type, field_key, label, field_type) values ('order', 'pet_name', 'Also pet name, different entity', 'text')$$,
  'the same field_key is allowed for a different entity_type within the same organization (unique constraint includes entity_type)'
);

select throws_ok(
  $$insert into public.field_definitions (entity_type, field_key, label, field_type) values ('customer', 'preferred_groomer', 'Preferred groomer', 'select')$$,
  '23514',
  null,
  'a select-type field definition with no options is rejected'
);

select throws_ok(
  $$insert into public.field_definitions (entity_type, field_key, label, field_type, options) values ('customer', 'preferred_groomer', 'Preferred groomer', 'select', '[]'::jsonb)$$,
  '23514',
  null,
  'a select-type field definition with an EMPTY options array is rejected'
);

select throws_ok(
  $$insert into public.field_definitions (entity_type, field_key, label, field_type) values ('customer', 'interests', 'Interests', 'multi_select')$$,
  '23514',
  null,
  'a multi_select-type field definition with no options is rejected'
);

select lives_ok(
  $$insert into public.field_definitions (id, entity_type, field_key, label, field_type, options) values ('d0000000-0000-0000-0000-000000000002', 'customer', 'preferred_groomer', 'Preferred groomer', 'select', '["Alex","Sam"]'::jsonb)$$,
  'a select-type field definition WITH options is accepted'
);

select throws_ok(
  $$insert into public.field_definitions (entity_type, field_key, label, field_type, is_core) values ('customer', 'not_a_real_core_key', 'Bad', 'text', true)$$,
  '23514',
  null,
  'an is_core field definition with a field_key outside the known whitelist (email/phone) is rejected'
);

select throws_ok(
  $$insert into public.field_definitions (entity_type, field_key, label, field_type, is_core) values ('order', 'email', 'Bad', 'text', true)$$,
  '23514',
  null,
  'an is_core field definition is rejected for entity_type = order (no whitelisted core keys exist for orders)'
);

select lives_ok(
  $$insert into public.field_definitions (id, entity_type, field_key, label, field_type, is_core) values ('d0000000-0000-0000-0000-000000000003', 'customer', 'phone', 'Phone', 'text', true)$$,
  'an is_core field definition with a whitelisted field_key (phone) for entity_type = customer is accepted'
);

select throws_ok(
  $$insert into public.field_definitions (organization_id, entity_type, field_key, label, field_type) values ('b0000000-0000-0000-0000-00000000000b', 'customer', 'spoofed_field', 'Spoofed', 'text')$$,
  '42501',
  null,
  'a member cannot insert a field definition with a spoofed organization_id belonging to another organization'
);

-- As member-b: cannot see, update, or delete org-a's field definitions.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"b2222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is(
  (select count(*)::int from public.field_definitions where organization_id = 'a0000000-0000-0000-0000-00000000000a'),
  0,
  'a different organization''s member CANNOT see org-a''s field definitions'
);

with attempted as (
  update public.field_definitions
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
  delete from public.field_definitions
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
  $$insert into public.field_definitions (entity_type, field_key, label, field_type) values ('customer', 'pet_name', 'Pet''s name', 'text')$$,
  'a different organization''s member can create their own field definition reusing the same field_key'
);

reset role;
select is(
  (select label from public.field_definitions where id = 'd0000000-0000-0000-0000-000000000001'),
  'Pet name',
  'org-a''s field definition was unaffected by the denied cross-organization attempts'
);

select is(
  (select count(*)::int from public.field_definitions where organization_id = 'a0000000-0000-0000-0000-00000000000a'),
  4,
  'org-a still has exactly its own four field definitions (pet_name, order/pet_name, preferred_groomer, phone)'
);

-- A member CAN update (including soft-hide via active) and delete their own
-- organization's field definition.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok(
  $$update public.field_definitions set active = false where id = 'd0000000-0000-0000-0000-000000000001'$$,
  'a member can soft-hide (toggle active) their own organization''s field definition'
);

select lives_ok(
  $$delete from public.field_definitions where id = 'd0000000-0000-0000-0000-000000000001'$$,
  'a member can delete their own organization''s field definition'
);

select * from finish();
rollback;
