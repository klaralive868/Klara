-- RLS test: a member can see/create/update their own organization's travel
-- inquiries, but not another organization's — including a regression
-- proving the EXISTS-based policy can't be spoofed by attaching an insert
-- to a customer_id belonging to a different organization (Standards §1;
-- the EXISTS pattern this guards against is documented in
-- docs/catalog-module.md, and is the exact class of bug a security review
-- caught for bookings — this table bakes the check in from the start).
begin;
select plan(8);

insert into public.organizations (id, name, slug) values
  ('88888888-8888-8888-8888-888888888888', 'Org Eight', 'org-eight-inquiries-rls'),
  ('99999999-9999-9999-9999-999999999999', 'Org Nine', 'org-nine-inquiries-rls');

insert into auth.users (id, email) values
  ('88888888-aaaa-aaaa-aaaa-888888888888', 'member-eight-inquiries-rls@example.com'),
  ('99999999-bbbb-bbbb-bbbb-999999999999', 'member-nine-inquiries-rls@example.com');

insert into public.organization_members (user_id, organization_id, role, status, claimed_at) values
  ('88888888-aaaa-aaaa-aaaa-888888888888', '88888888-8888-8888-8888-888888888888', 'owner', 'active', now()),
  ('99999999-bbbb-bbbb-bbbb-999999999999', '99999999-9999-9999-9999-999999999999', 'owner', 'active', now());

insert into public.customers (id, organization_id, full_name, email, source) values
  ('30000000-0000-0000-0000-000000000004', '88888888-8888-8888-8888-888888888888', 'Jane Traveler', 'jane-eight-inq@example.com', 'manual'),
  ('30000000-0000-0000-0000-000000000005', '99999999-9999-9999-9999-999999999999', 'John Traveler', 'john-nine-inq@example.com', 'manual');

insert into public.travel_inquiries (id, customer_id, trip_description) values
  ('50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004', 'A week in the Alps, exact dates flexible.');

-- As member-eight: can see and write their own organization's inquiry.
set local role authenticated;
set local request.jwt.claims = '{"sub":"88888888-aaaa-aaaa-aaaa-888888888888","role":"authenticated"}';

select is(
  (select count(*)::int from public.travel_inquiries where id = '50000000-0000-0000-0000-000000000001'),
  1,
  'a member can see their own organization''s inquiry'
);

select lives_ok(
  $$insert into public.travel_inquiries (customer_id, trip_description) values ('30000000-0000-0000-0000-000000000004', 'Solo trip to Peru.')$$,
  'a member can insert an inquiry against their own organization''s customer'
);

select is(
  (select count(*)::int from public.travel_inquiries),
  2,
  'the inserted inquiry is visible to the inserting member'
);

select lives_ok(
  $$update public.travel_inquiries set status = 'in-progress' where id = '50000000-0000-0000-0000-000000000001'$$,
  'a member can update (progress) their own organization''s inquiry'
);

-- Regression: member-eight cannot insert an inquiry against a customer_id
-- from a different organization — the FK alone only proves the row exists,
-- not who owns it.
select throws_ok(
  $$insert into public.travel_inquiries (customer_id, trip_description) values ('30000000-0000-0000-0000-000000000005', 'Spoofed customer attempt.')$$,
  '42501',
  'new row violates row-level security policy for table "travel_inquiries"',
  'a member cannot insert an inquiry against another organization''s customer (spoofed customer_id)'
);

-- As member-nine: cannot see or write org-eight's inquiry.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"99999999-bbbb-bbbb-bbbb-999999999999","role":"authenticated"}';

select is(
  (select count(*)::int from public.travel_inquiries where id = '50000000-0000-0000-0000-000000000001'),
  0,
  'a different organization''s member CANNOT see org-eight''s inquiry'
);

with attempted as (
  update public.travel_inquiries
  set status = 'closed'
  where id = '50000000-0000-0000-0000-000000000001'
  returning id
)
select is(
  (select count(*)::int from attempted),
  0,
  'a different organization''s member CANNOT update org-eight''s inquiry'
);

reset role;
select is(
  (select status from public.travel_inquiries where id = '50000000-0000-0000-0000-000000000001'),
  'in-progress',
  'org-eight''s inquiry was unaffected by the denied cross-organization update attempt'
);

select * from finish();
rollback;
