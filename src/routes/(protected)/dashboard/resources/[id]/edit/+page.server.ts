import { error } from '@sveltejs/kit';
import { getPlaceholderResource } from '$lib/bookings/placeholder-resources';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const resource = getPlaceholderResource(params.id);
	if (!resource) {
		error(404, 'Resource not found');
	}
	return { resource };
};
