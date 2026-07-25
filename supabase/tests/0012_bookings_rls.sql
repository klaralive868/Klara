-- RLS test: a member can see/create/update their own organization's
-- bookings, but not another organization's — including a regression proving
-- the EXISTS-based policy can't be spoofed by attaching an insert to a
-- resource_id belonging to a different organization than the caller's own
-- (Standards §1; the EXISTS pattern this guards against is documented in
-- docs/catalog-module.md).
begin;
select plan(8);

insert into public.organizations (id, name, slug) values
  ('88888888-8888-8888-8888-888888888888', 'Org Eight', 'org-eight-bookings-rls'),
  ('99999999-9999-9999-9999-999999999999', 'Org Nine', 'org-nine-bookings-rls');

insert into auth.users (id, email) values
  ('88888888-aaaa-aaaa-aaaa-888888888888', 'member-eight-bookings-rls@example.com'),
  ('99999999-bbbb-bbbb-bbbb-999999999999', 'member-nine-bookings-rls@example.com');

insert into public.organization_members (user_id, organization_id, role, status, claimed_at) values
  ('88888888-aaaa-aaaa-aaaa-888888888888', '88888888-8888-8888-8888-888888888888', 'owner', 'active', now()),
  ('99999999-bbbb-bbbb-bbbb-999999999999', '99999999-9999-9999-9999-999999999999', 'owner', 'active', now());

insert into public.resources (id, organization_id, name, departure_date, return_date, price_cents) values
  ('20000000-0000-0000-0000-000000000003', '88888888-8888-8888-8888-888888888888', 'Org Eight Bali Tour', '2026-08-12', '2026-08-19', 199999),
  ('20000000-0000-0000-0000-000000000004', '99999999-9999-9999-9999-999999999999', 'Org Nine Ski Trip', '2027-01-10', '2027-01-17', 250000);

insert into public.customers (id, organization_id, full_name, email, source) values
  ('30000000-0000-0000-0000-000000000002', '88888888-8888-8888-8888-888888888888', 'Jane Traveler', 'jane-eight@example.com', 'manual'),
  ('30000000-0000-0000-0000-000000000003', '99999999-9999-9999-9999-999999999999', 'John Traveler', 'john-nine@example.com', 'manual');

insert into public.bookings (id, resource_id, customer_id, traveler_count, start_at, end_at) values
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 2, '2026-08-12', '2026-08-19');

-- As member-eight: can see and write their own organization's booking.
set local role authenticated;
set local request.jwt.claims = '{"sub":"88888888-aaaa-aaaa-aaaa-888888888888","role":"authenticated"}';

select is(
  (select count(*)::int from public.bookings where id = '40000000-0000-0000-0000-000000000001'),
  1,
  'a member can see their own organization''s booking'
);

select lives_ok(
  $$insert into public.bookings (resource_id, customer_id, traveler_count, start_at, end_at) values ('20000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 1, '2026-08-12', '2026-08-19')$$,
  'a member can insert a booking against their own organization''s resource and customer'
);

select is(
  (select count(*)::int from public.bookings),
  2,
  'the inserted booking is visible to the inserting member'
);

select lives_ok(
  $$update public.bookings set status = 'confirmed' where id = '40000000-0000-0000-0000-000000000001'$$,
  'a member can update (confirm) their own organization''s booking'
);

-- Regression: member-eight cannot spoof ownership by attaching an insert to
-- a resource_id from a different organization, even with a customer_id
-- that's genuinely their own — the EXISTS check is keyed off resource_id,
-- not customer_id, so this must be denied on that basis alone.
select throws_ok(
  $$insert into public.bookings (resource_id, customer_id, traveler_count, start_at, end_at) values ('20000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', 1, '2027-01-10', '2027-01-17')$$,
  '42501',
  'new row violates row-level security policy for table "bookings"',
  'a member cannot insert a booking against another organization''s resource (spoofed resource_id)'
);

-- As member-nine: cannot see or write org-eight's booking.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"99999999-bbbb-bbbb-bbbb-999999999999","role":"authenticated"}';

select is(
  (select count(*)::int from public.bookings where id = '40000000-0000-0000-0000-000000000001'),
  0,
  'a different organization''s member CANNOT see org-eight''s booking'
);

-- An update targeting another organization's row is silently filtered by RLS
-- (0 rows affected), not an error.
with attempted as (
  update public.bookings
  set status = 'cancelled'
  where id = '40000000-0000-0000-0000-000000000001'
  returning id
)
select is(
  (select count(*)::int from attempted),
  0,
  'a different organization''s member CANNOT update org-eight''s booking'
);

reset role;
select is(
  (select status from public.bookings where id = '40000000-0000-0000-0000-000000000001'),
  'confirmed',
  'org-eight''s booking was unaffected by the denied cross-organization update attempt'
);

select * from finish();
rollback;
