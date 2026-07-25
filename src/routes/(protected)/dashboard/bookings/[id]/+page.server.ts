import { error } from '@sveltejs/kit';
import { getPlaceholderBooking } from '$lib/bookings/placeholder-bookings';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const booking = getPlaceholderBooking(params.id);
	if (!booking) {
		error(404, 'Booking not found');
	}
	return { booking };
};
