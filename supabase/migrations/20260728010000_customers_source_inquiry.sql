-- Code review of #47: findOrCreateCustomer (built for booking submissions,
-- reused verbatim by the inquiry submission action per this ticket's own
-- spec) hardcoded source: 'booking' — a customer created purely through a
-- travel inquiry, never a booking, was mislabeled. Adds 'inquiry' as a
-- valid source so the caller can say which public flow actually created
-- the record.
alter table public.customers drop constraint customers_source_check;
alter table public.customers add constraint customers_source_check
	check (source in ('booking', 'inquiry', 'manual', 'import'));
