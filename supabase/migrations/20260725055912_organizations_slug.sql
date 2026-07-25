-- Public URL slug for an organization, needed by the upcoming Bookings
-- public-facing routes (spec: docs/bookings-travel-packages-spec.md) so a
-- client's public pages have a stable, readable identifier instead of a raw
-- database id. Operator-set at provisioning time going forward
-- (src/lib/server/admin-provisioning.ts owns the real validation) — this
-- migration only needs to backfill whatever organizations already exist so
-- the `not null unique` constraint can be added without breaking them.
alter table public.organizations add column slug text;

with slugified as (
	select
		id,
		nullif(
			lower(regexp_replace(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g')),
			''
		) as base_slug
	from public.organizations
),
with_fallback as (
	select
		id,
		coalesce(base_slug, 'org-' || substring(id::text, 1, 8)) as base_slug
	from slugified
),
numbered as (
	select
		id,
		base_slug,
		row_number() over (partition by base_slug order by id) as dup_index
	from with_fallback
),
deduped as (
	select
		id,
		case when dup_index = 1 then base_slug else base_slug || '-' || dup_index end as final_slug
	from numbered
)
update public.organizations o
set slug = d.final_slug
from deduped d
where o.id = d.id;

alter table public.organizations alter column slug set not null;
alter table public.organizations add constraint organizations_slug_key unique (slug);
