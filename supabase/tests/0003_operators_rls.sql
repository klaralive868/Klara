-- RLS test: a user can see their own operators row (or its absence), but
-- cannot see another user's operator status. Also asserts the table's
-- entire write-security model — no INSERT/UPDATE/DELETE grant exists for
-- `authenticated`, so operator status can only ever change via service_role
-- (ADR-0003: a manual, one-time bootstrap step, never an app-driven write).
begin;
select plan(9);

insert into auth.users (id, email) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'operator@example.com'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'non-operator@example.com');

insert into public.operators (user_id) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');

-- As the operator: can see their own row.
set local role authenticated;
set local request.jwt.claims = '{"sub":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","role":"authenticated"}';

select is(
  (select count(*)::int from public.operators where user_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  1,
  'an operator can see their own operators row'
);

-- Being an operator grants no write access either — still no INSERT/UPDATE/
-- DELETE grant for `authenticated`, operator or not. An operator cannot even
-- touch their own row this way, let alone anyone else's.
select throws_ok(
  $$insert into public.operators (user_id) values ('ffffffff-ffff-ffff-ffff-ffffffffffff')$$,
  '42501',
  'permission denied for table operators',
  'an operator cannot insert into operators (granting someone else operator status)'
);

select throws_ok(
  $$update public.operators set created_at = now() where user_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'$$,
  '42501',
  'permission denied for table operators',
  'an operator cannot update their own operators row'
);

select throws_ok(
  $$delete from public.operators where user_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'$$,
  '42501',
  'permission denied for table operators',
  'an operator cannot delete their own operators row (self-revoking)'
);

-- As a non-operator: cannot see the operator's row.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"ffffffff-ffff-ffff-ffff-ffffffffffff","role":"authenticated"}';

select is(
  (select count(*)::int from public.operators where user_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  0,
  'a different, non-operator user CANNOT see the operator''s row'
);

select is(
  (select count(*)::int from public.operators where user_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'),
  0,
  'a non-operator querying their own user_id correctly sees no row'
);

-- Same, as a non-operator (self-granting operator status) — completing the
-- "operator or not" coverage the block above started under the operator's own JWT.
select throws_ok(
  $$insert into public.operators (user_id) values ('ffffffff-ffff-ffff-ffff-ffffffffffff')$$,
  '42501',
  'permission denied for table operators',
  'a non-operator cannot insert into operators (self-granting operator status)'
);

select throws_ok(
  $$update public.operators set created_at = now() where user_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'$$,
  '42501',
  'permission denied for table operators',
  'a non-operator cannot update an operators row'
);

select throws_ok(
  $$delete from public.operators where user_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'$$,
  '42501',
  'permission denied for table operators',
  'a non-operator cannot delete an operators row (revoking someone else''s operator status)'
);

select * from finish();
rollback;
