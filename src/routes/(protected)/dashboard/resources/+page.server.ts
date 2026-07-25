import { PLACEHOLDER_RESOURCES } from '$lib/bookings/placeholder-resources';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return { resources: PLACEHOLDER_RESOURCES };
};
