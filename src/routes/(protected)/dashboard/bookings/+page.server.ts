import { BOOKING_SELECT, bookingFromRow, type BookingRow } from '$lib/bookings/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { data, error } = await locals.supabase
		.from('bookings')
		.select(BOOKING_SELECT)
		.order('created_at', { ascending: false });

	if (error) {
		console.error('bookings: failed to load bookings', error);
		return { bookings: [] };
	}

	return { bookings: (data as unknown as BookingRow[]).map(bookingFromRow) };
};
