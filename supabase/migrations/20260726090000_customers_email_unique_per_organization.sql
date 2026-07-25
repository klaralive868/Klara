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
--
-- The prior schema had no such constraint, so an organization may already
-- have two+ customer rows whose emails differ only by case — exactly the
-- duplicate identity this index exists to prevent going forward. Rather
-- than let the index creation below reject that pre-existing data, merge
-- each such group first: keep the oldest row as canonical, reassign any
-- bookings pointing at a duplicate over to it, then drop the duplicates.
-- A straight DELETE would silently orphan those bookings' history.
do $$
declare
	dup record;
	canonical_id uuid;
begin
	for dup in
		select organization_id, lower(email) as email_lower
		from public.customers
		where email is not null
		group by organization_id, lower(email)
		having count(*) > 1
	loop
		select id into canonical_id
		from public.customers
		where organization_id = dup.organization_id
			and lower(email) = dup.email_lower
		order by created_at asc, id asc
		limit 1;

		update public.bookings
		set customer_id = canonical_id
		where customer_id in (
			select id from public.customers
			where organization_id = dup.organization_id
				and lower(email) = dup.email_lower
				and id <> canonical_id
		);

		delete from public.customers
		where organization_id = dup.organization_id
			and lower(email) = dup.email_lower
			and id <> canonical_id;
	end loop;
end $$;

create unique index customers_organization_id_email_lower_key
	on public.customers (organization_id, lower(email))
	where email is not null;
