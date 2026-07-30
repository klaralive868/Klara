-- Extends travel_inquiries to capture what WorldView's "Curated" trip-request
-- form actually collects, which party_size/preferred_dates alone can't hold
-- structurally (adult/child breakdown, a destination, style tags, a
-- flights-included preference, a flexible-dates toggle).
--
-- Additive only — party_size stays, still read/written by the manual "Log
-- inquiry" dashboard flow (src/lib/server/inquiries.ts), which this migration
-- deliberately doesn't touch (out of scope here: only the public endpoint and
-- the agent-side list/detail *views* were asked for, not the manual-entry
-- form). Dropping party_size is a separate, later decision once/if that flow
-- is migrated too.
alter table public.travel_inquiries
	add column adult_count integer not null default 1 check (adult_count >= 1),
	add column child_count integer not null default 0 check (child_count >= 0),
	add column destination text,
	-- No check-constraint enum: the exact tag set is WorldView's form's to
	-- define, not something this repo can verify against their actual
	-- checkboxes right now. Locking it here would mean a Klara-side
	-- migration every time their form's tag list changes — left
	-- unconstrained on purpose, same freeform-adjacent treatment as
	-- destination/budget/preferred_dates.
	add column travel_style text[],
	add column include_flights boolean not null default false,
	add column dates_flexible boolean not null default false;
