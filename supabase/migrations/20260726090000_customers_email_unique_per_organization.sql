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
-- A straight DELETE would silently orphan those bookings' history *and*
-- discard any profile data unique to the duplicate rows (a different
-- phone number, custom field values, source, status, or even a
-- differently-spelled name) — there's no automatic rule that can safely
-- pick a winner when two rows genuinely disagree, so nothing is dropped:
-- phone/custom_fields gaps on the canonical row are backfilled from a
-- duplicate (never overwriting a value the canonical row already has),
-- and a full snapshot of every removed row's fields is preserved on the
-- canonical row's custom_fields under a reserved key for a human to
-- review and reconcile by hand later.
do $$
declare
	dup_group record;
	other record;
	canonical_id uuid;
	merged_phone text;
	merged_custom_fields jsonb;
	audit_snapshot jsonb;
begin
	for dup_group in
		select organization_id, lower(email) as email_lower
		from public.customers
		where email is not null
		group by organization_id, lower(email)
		having count(*) > 1
	loop
		select id, phone, custom_fields
		into canonical_id, merged_phone, merged_custom_fields
		from public.customers
		where organization_id = dup_group.organization_id
			and lower(email) = dup_group.email_lower
		order by created_at asc, id asc
		limit 1;

		audit_snapshot := '[]'::jsonb;

		for other in
			select *
			from public.customers
			where organization_id = dup_group.organization_id
				and lower(email) = dup_group.email_lower
				and id <> canonical_id
			order by created_at asc, id asc
		loop
			if merged_phone is null then
				merged_phone := other.phone;
			end if;

			-- jsonb `a || b` has b's keys win on conflict — putting the
			-- accumulator (canonical-rooted) on the right keeps the
			-- canonical row's own values authoritative while still folding
			-- in any key the duplicate had that the canonical row didn't.
			merged_custom_fields := other.custom_fields || merged_custom_fields;

			audit_snapshot := audit_snapshot || jsonb_build_array(jsonb_build_object(
				'id', other.id,
				'full_name', other.full_name,
				'email', other.email,
				'phone', other.phone,
				'source', other.source,
				'status', other.status,
				'custom_fields', other.custom_fields,
				'created_at', other.created_at
			));
		end loop;

		merged_custom_fields := merged_custom_fields
			|| jsonb_build_object('_merged_duplicate_customers', audit_snapshot);

		update public.bookings
		set customer_id = canonical_id
		where customer_id in (
			select id from public.customers
			where organization_id = dup_group.organization_id
				and lower(email) = dup_group.email_lower
				and id <> canonical_id
		);

		update public.customers
		set phone = merged_phone,
			custom_fields = merged_custom_fields
		where id = canonical_id;

		delete from public.customers
		where organization_id = dup_group.organization_id
			and lower(email) = dup_group.email_lower
			and id <> canonical_id;
	end loop;
end $$;

create unique index customers_organization_id_email_lower_key
	on public.customers (organization_id, lower(email))
	where email is not null;
