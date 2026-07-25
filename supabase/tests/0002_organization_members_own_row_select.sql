-- RLS test: a pending member can see their own (pending) membership row, but
-- still CANNOT see another user's row — the new policy must not leak across
-- users even though it drops the "must be active" requirement.
begin;
select plan(4);

insert into public.organizations (id, name, slug) values
  ('33333333-3333-3333-3333-333333333333', 'Org Three', 'org-three');

insert into auth.users (id, email) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'pending-member@example.com'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'other-user@example.com');

insert into public.organization_members (user_id, organization_id, role, status) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', 'staff', 'pending');

-- As the pending member: can see their own pending row.
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}';

select is(
  (select count(*)::int from public.organization_members where user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  1,
  'a pending member can see their own pending membership row'
);

select is(
  (select status::text from public.organization_members where user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  'pending',
  'the visible row correctly reports status = pending'
);

-- As a different, real user with no membership at all: cannot see it.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated"}';

select is(
  (select count(*)::int from public.organization_members where user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  0,
  'a different user CANNOT see the pending member''s row'
);

select is(
  (select count(*)::int from public.organization_members where user_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  0,
  'a user with no membership row sees none — the policy does not leak rows to non-members'
);

select * from finish();
rollback;
