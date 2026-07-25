-- RLS test: bookings currently has no authenticated policies at all (that's
-- ticket #44's job) — the only writer today is #43's public booking action,
-- which uses the service-role client. Prove an authenticated member has zero
-- access in the meantime, so nothing is silently readable/writable before
-- #44's real policies land.
begin;
select plan(3);

insert into public.organizations (id, name, slug) values
  ('88888888-8888-8888-8888-888888888888', 'Org Eight', 'org-eight-bookings');

insert into auth.users (id, email) values
  ('88888888-aaaa-aaaa-aaaa-888888888888', 'member-eight-bookings@example.com');

insert into public.organization_members (user_id, organization_id, role, status, claimed_at) values
  ('88888888-aaaa-aaaa-aaaa-888888888888', '88888888-8888-8888-8888-888888888888', 'owner', 'active', now());

insert into public.resources (id, organization_id, name, departure_date, return_date, price_cents) values
  ('20000000-0000-0000-0000-000000000002', '88888888-8888-8888-8888-888888888888', 'Org Eight Bali Tour', '2026-08-12', '2026-08-19', 199999);

insert into public.customers (id, organization_id, full_name, email, source) values
  ('30000000-0000-0000-0000-000000000001', '88888888-8888-8888-8888-888888888888', 'Jane Traveler', 'jane@example.com', 'booking');

set local role authenticated;
set local request.jwt.claims = '{"sub":"88888888-aaaa-aaaa-aaaa-888888888888","role":"authenticated"}';

-- No grant exists yet for `authenticated` on this table at all (not just no
-- policy) — that's a harder "permission denied" than an RLS-filtered read,
-- since #44 hasn't added its grants/policies yet.
select throws_ok(
  $$select count(*) from public.bookings$$,
  '42501',
  'permission denied for table bookings',
  'an authenticated member cannot read bookings before #44 grants access'
);

select throws_ok(
  $$insert into public.bookings (resource_id, customer_id, traveler_count, start_at, end_at) values ('20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 2, '2026-08-12', '2026-08-19')$$,
  '42501',
  'permission denied for table bookings',
  'an authenticated member cannot insert a booking before #44 grants access'
);

reset role;
select is(
  (select count(*)::int from public.bookings),
  0,
  'no booking was created by the denied authenticated insert attempt'
);

select * from finish();
rollback;
