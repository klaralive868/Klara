import { PLACEHOLDER_BOOKINGS } from '$lib/bookings/placeholder-bookings';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return { bookings: PLACEHOLDER_BOOKINGS };
};
