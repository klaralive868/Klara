-- RLS test: a member can see their own organization's module config, but not
-- another organization's. Also asserts the deny-by-default write model.
begin;
select plan(5);

insert into public.organizations (id, name) values
  ('44444444-4444-4444-4444-444444444444', 'Org Four'),
  ('55555555-5555-5555-5555-555555555555', 'Org Five');

insert into auth.users (id, email) values
  ('99999999-9999-9999-9999-999999999999', 'member-four@example.com'),
  ('88888888-8888-8888-8888-888888888888', 'member-five@example.com');

insert into public.organization_members (user_id, organization_id, role, status, claimed_at) values
  ('99999999-9999-9999-9999-999999999999', '44444444-4444-4444-4444-444444444444', 'owner', 'active', now()),
  ('88888888-8888-8888-8888-888888888888', '55555555-5555-5555-5555-555555555555', 'owner', 'active', now());

insert into public.client_modules (organization_id, module, tier) values
  ('44444444-4444-4444-4444-444444444444', 'catalog', 'clothing');

-- As member-four: can see their own organization's module config.
set local role authenticated;
set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';

select is(
  (select count(*)::int from public.client_modules where organization_id = '44444444-4444-4444-4444-444444444444'),
  1,
  'a member can see their own organization''s client_modules row'
);

select is(
  (select tier from public.client_modules where organization_id = '44444444-4444-4444-4444-444444444444'),
  'clothing',
  'the visible row correctly reports tier = clothing'
);

-- As member-five: cannot see org-four's module config.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"88888888-8888-8888-8888-888888888888","role":"authenticated"}';

select is(
  (select count(*)::int from public.client_modules where organization_id = '44444444-4444-4444-4444-444444444444'),
  0,
  'a different organization''s member CANNOT see org-four''s client_modules row'
);

-- No authenticated user can write to client_modules — provisioning is
-- service_role only (closed, operator-provisioned model).
select throws_ok(
  $$insert into public.client_modules (organization_id, module, tier) values ('55555555-5555-5555-5555-555555555555', 'catalog', 'clothing')$$,
  '42501',
  'permission denied for table client_modules',
  'an authenticated user cannot insert into client_modules'
);

select throws_ok(
  $$update public.client_modules set tier = 'hardware' where organization_id = '44444444-4444-4444-4444-444444444444'$$,
  '42501',
  'permission denied for table client_modules',
  'an authenticated user cannot update a client_modules row'
);

select * from finish();
rollback;
