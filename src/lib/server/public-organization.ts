import type { SupabaseClient } from '@supabase/supabase-js';

export interface PublicOrganization {
	id: string;
	slug: string;
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
		.select('id, slug')
		.eq('slug', slug)
		.maybeSingle();

	if (error || !data) {
		return null;
	}

	return data;
}
