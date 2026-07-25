import { PLACEHOLDER_INQUIRIES } from '$lib/bookings/placeholder-inquiries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return { inquiries: PLACEHOLDER_INQUIRIES };
};
