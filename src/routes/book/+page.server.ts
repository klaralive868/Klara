import { PLACEHOLDER_RESOURCES, toPublicResource } from '$lib/bookings/placeholder-resources';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Only published resources are ever publicly visible — draft/archived
	// stay agent-only (Standards §5: soft-delete/visibility lifecycle).
	const resources = PLACEHOLDER_RESOURCES.filter((resource) => resource.status === 'published').map(
		toPublicResource
	);
	return { resources };
};
