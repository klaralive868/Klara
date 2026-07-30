-- Extends resources with the fields WorldView's live /packages page depends
-- on for filtering and display, which the current schema has no way to hold:
-- category, region, and marketing highlights.
--
-- No check-constraint enum on category/region: same reasoning as
-- travel_inquiries.travel_style (20260730040000) — locking either to a fixed
-- set requires knowing WorldView's actual dropdown values first, which isn't
-- confirmable from this repo. Unconstrained free text, same as name/
-- description, until/unless that's confirmed and asked for explicitly.
alter table public.resources
	add column category text,
	add column region text,
	add column highlights text[];
