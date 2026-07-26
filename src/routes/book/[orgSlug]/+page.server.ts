import { error } from '@sveltejs/kit';
import { createSupabaseAdminClient } from '$lib/server/supabase-admin';
import { getOrganizationBySlug } from '$lib/server/public-organization';
import { listPublishedResources } from '$lib/server/public-resources';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	// organizations has no anon-read policy — the slug is resolved server-side
	// through the service-role client, never trusted from anywhere else.
	const admin = createSupabaseAdminClient();
	const organization = await getOrganizationBySlug(admin, params.orgSlug);
	if (!organization) {
		error(404, 'Not found');
	}

	// Only published resources are ever publicly visible — draft/archived
	// stay agent-only (Standards §5: soft-delete/visibility lifecycle).
	const resources = await listPublishedResources(admin, organization.id);
	return { resources };
};
