import type { SupabaseClient } from '@supabase/supabase-js';

export interface PublicOrganization {
	id: string;
	slug: string;
	allowedOrigins: string[];
}

interface PublicOrganizationRow {
	id: string;
	slug: string;
	allowed_origins: string[] | null;
}

// organizations has no anon/authenticated-read policy at all (RLS is enabled
// with zero public-facing grants), so a public route can only resolve a slug
// through the service-role client — never trust a client-supplied org id,
// only the raw slug string from the URL.
export async function getOrganizationBySlug(
	supabase: SupabaseClient,
	slug: string
): Promise<PublicOrganization | null> {
	const { data, error } = await supabase
		.from('organizations')
		.select('id, slug, allowed_origins')
		.eq('slug', slug)
		.maybeSingle();

	if (error || !data) {
		return null;
	}

	const row = data as PublicOrganizationRow;
	// allowed_origins is nullable (Standards §12: fail-closed) — normalized
	// to [] here so every caller checks membership the same way regardless
	// of whether the column was ever set.
	return { id: row.id, slug: row.slug, allowedOrigins: row.allowed_origins ?? [] };
}
