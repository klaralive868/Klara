-- Closes a race window in the public booking flow (Bookings #43 review):
-- findOrCreateCustomer does a select-then-insert with nothing at the DB
-- layer stopping two concurrent first-time requests for the same
-- (organization_id, email) from both passing the lookup and both
-- inserting, producing two customer rows (and two bookings pointing at
-- different customers) for what should be one identity. A case-insensitive
-- unique index — matching the case-insensitive ilike match already used for
-- lookups — makes the second concurrent insert fail with 23505 instead of
-- silently succeeding; the application layer recovers by re-selecting the
-- winning row.
--
-- Partial (where email is not null) since customers created through the
-- authenticated dashboard form may have no email at all, and null <> null
-- for uniqueness purposes anyway.
create unique index customers_organization_id_email_lower_key
	on public.customers (organization_id, lower(email))
	where email is not null;
