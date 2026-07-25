import { error } from '@sveltejs/kit';
import { getPlaceholderResource } from '$lib/bookings/placeholder-resources';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const resource = getPlaceholderResource(params.id);
	// A draft/archived resource 404s the same as a nonexistent one — a
	// visitor should never be able to tell the difference between "no such
	// package" and "this package isn't public yet" (Standards §5's
	// visibility-lifecycle intent, applied to the public surface).
	if (!resource || resource.status !== 'published') {
		error(404, 'Package not found');
	}
	return { resource };
};
