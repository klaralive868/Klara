-- RLS test: a member can see their own organization and membership row,
-- and CANNOT see another organization's data — per Standards §1, a policy
-- suite that only checks the happy path is incomplete.
begin;
select plan(6);

-- Two organizations, two distinct real users, one membership each.
insert into public.organizations (id, name) values
  ('11111111-1111-1111-1111-111111111111', 'Org One'),
  ('22222222-2222-2222-2222-222222222222', 'Org Two');

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'member-one@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'member-two@example.com');

insert into public.organization_members (user_id, organization_id, role, status, claimed_at) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner', 'active', now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'owner', 'active', now());

-- As member-one: can see own organization.
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

select is(
  (select count(*)::int from public.organizations where id = '11111111-1111-1111-1111-111111111111'),
  1,
  'member-one can see their own organization'
);

select is(
  (select count(*)::int from public.organizations where id = '22222222-2222-2222-2222-222222222222'),
  0,
  'member-one CANNOT see org-two'
);

select is(
  (select count(*)::int from public.organization_members where organization_id = '11111111-1111-1111-1111-111111111111'),
  1,
  'member-one can see their own membership row'
);

select is(
  (select count(*)::int from public.organization_members where organization_id = '22222222-2222-2222-2222-222222222222'),
  0,
  'member-one CANNOT see org-two membership rows'
);

-- As member-two: symmetric check, using a genuinely different identity.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';

select is(
  (select count(*)::int from public.organizations where id = '22222222-2222-2222-2222-222222222222'),
  1,
  'member-two can see their own organization'
);

select is(
  (select count(*)::int from public.organizations where id = '11111111-1111-1111-1111-111111111111'),
  0,
  'member-two CANNOT see org-one'
);

select * from finish();
rollback;
