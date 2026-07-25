// Mirrors the backfill logic in supabase/migrations/20260725055912_organizations_slug.sql
// (lowercase, collapse non-alphanumeric runs to a single hyphen, trim edges) —
// kept in sync deliberately so a slug this function proposes looks the same
// whether it came from the app or that one-off migration.
export function slugify(input: string): string {
	return input
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isValidSlug(value: string): boolean {
	return SLUG_PATTERN.test(value);
}
