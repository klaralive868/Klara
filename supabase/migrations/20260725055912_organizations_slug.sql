-- Public URL slug for an organization, needed by the upcoming Bookings
-- public-facing routes (spec: docs/bookings-travel-packages-spec.md) so a
-- client's public pages have a stable, readable identifier instead of a raw
-- database id. Operator-set at provisioning time going forward
-- (src/lib/server/admin-provisioning.ts owns the real validation) — this
-- migration only needs to backfill whatever organizations already exist so
-- the `not null unique` constraint can be added without breaking them.
alter table public.organizations add column slug text;

-- Any *formula*-based suffix (a counter, a truncated id prefix, ...) is only
-- probabilistically safe — it can never be proven not to collide with some
-- possible human-entered name, since the suffix space and the name-derived
-- space aren't provably disjoint. The only actually collision-proof
-- approach is to check each candidate against everything already assigned
-- so far and keep incrementing until it's genuinely free, which needs a
-- procedural loop rather than a single set-based query. A plain O(n^2)
-- array-membership check is fine here — this runs once, over however many
-- organizations exist at migration time, not an ongoing hot path.
do $$
declare
	org record;
	base text;
	candidate text;
	suffix int;
	used_slugs text[] := '{}';
begin
	for org in select id, name from public.organizations order by id loop
		base := coalesce(
			nullif(
				lower(regexp_replace(regexp_replace(org.name, '[^a-zA-Z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g')),
				''
			),
			'org-' || substring(org.id::text, 1, 8)
		);

		candidate := base;
		suffix := 1;
		while candidate = any(used_slugs) loop
			suffix := suffix + 1;
			candidate := base || '-' || suffix;
		end loop;

		used_slugs := array_append(used_slugs, candidate);
		update public.organizations set slug = candidate where id = org.id;
	end loop;
end $$;

alter table public.organizations alter column slug set not null;
alter table public.organizations add constraint organizations_slug_key unique (slug);
