import { error, fail } from '@sveltejs/kit';
import { bookingFromRow, type BookingRow } from '$lib/bookings/types';
import type { Actions, PageServerLoad } from './$types';

const BOOKING_SELECT =
	'id, resource_id, customer_id, traveler_count, notes, status, start_at, end_at, resources(name), customers(full_name, email)';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { data, error: loadError } = await locals.supabase
		.from('bookings')
		.select(BOOKING_SELECT)
		.eq('id', params.id)
		.maybeSingle();

	if (loadError) {
		console.error('bookings: failed to load booking', loadError);
		error(500, 'Could not load this booking.');
	}

	// RLS silently excludes another organization's booking rather than
	// erroring — a null row means "not found or not yours," both 404.
	if (!data) {
		error(404, 'Booking not found');
	}

	return { booking: bookingFromRow(data as unknown as BookingRow) };
};

export const actions: Actions = {
	// Capacity (a resource's quantity) is purely informational and never
	// gates this or any other transition (Bookings #44 spec) — the only
	// preconditions here are status ones.
	confirm: async ({ params, locals }) => {
		const { data, error: updateError } = await locals.supabase
			.from('bookings')
			.update({ status: 'confirmed' })
			.eq('id', params.id)
			.eq('status', 'pending')
			.select('id')
			.maybeSingle();

		if (updateError) {
			return fail(500, { message: 'Could not confirm the booking. Please try again.' });
		}
		if (!data) {
			return fail(404, { message: 'Booking not found or not pending.' });
		}

		return { success: true, message: 'Booking confirmed.' };
	},

	// Cancel works from either pending or confirmed — never a dead end, same
	// reasoning as Resources' archive action having no status precondition.
	cancel: async ({ params, locals }) => {
		const { data, error: updateError } = await locals.supabase
			.from('bookings')
			.update({ status: 'cancelled' })
			.eq('id', params.id)
			.in('status', ['pending', 'confirmed'])
			.select('id')
			.maybeSingle();

		if (updateError) {
			return fail(500, { message: 'Could not cancel the booking. Please try again.' });
		}
		if (!data) {
			return fail(404, { message: 'Booking not found or already cancelled/completed.' });
		}

		return { success: true, message: 'Booking cancelled.' };
	},

	complete: async ({ params, locals }) => {
		const { data, error: updateError } = await locals.supabase
			.from('bookings')
			.update({ status: 'completed' })
			.eq('id', params.id)
			.eq('status', 'confirmed')
			.select('id')
			.maybeSingle();

		if (updateError) {
			return fail(500, { message: 'Could not complete the booking. Please try again.' });
		}
		if (!data) {
			return fail(404, { message: 'Booking not found or not confirmed.' });
		}

		return { success: true, message: 'Booking marked completed.' };
	}
};
