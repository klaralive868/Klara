-- Bookings #47: the public inquiry submission action writes via the
-- service-role client (RLS untouched, no anon grants) — but service_role
-- bypassing RLS doesn't imply it has table-level DML grants; those are
-- separate in Postgres and have to be explicit, same as every other public-
-- writable table (see bookings' service_role grant in
-- 20260725140000_bookings.sql). #48's original travel_inquiries migration
-- only granted authenticated (the dashboard use case it was built for),
-- since the public writer didn't exist yet.
grant usage on schema public to service_role;
grant select, insert, update on public.travel_inquiries to service_role;
