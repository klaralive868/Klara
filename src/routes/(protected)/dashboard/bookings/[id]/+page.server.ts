import { error } from '@sveltejs/kit';
import { BOOKING_SELECT, bookingFromRow, type BookingRow } from '$lib/bookings/types';
import { transitionBookingStatus } from '$lib/server/bookings';
import type { Actions, PageServerLoad } from './$types';

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
	confirm: async ({ params, locals }) =>
		transitionBookingStatus(locals.supabase, params.id, {
			to: 'confirmed',
			fromAnyOf: ['pending'],
			genericErrorMessage: 'Could not confirm the booking. Please try again.',
			notFoundMessage: 'Booking not found or not pending.',
			successMessage: 'Booking confirmed.'
		}),

	// Cancel works from either pending or confirmed — never a dead end, same
	// reasoning as Resources' archive action having no status precondition.
	cancel: async ({ params, locals }) =>
		transitionBookingStatus(locals.supabase, params.id, {
			to: 'cancelled',
			fromAnyOf: ['pending', 'confirmed'],
			genericErrorMessage: 'Could not cancel the booking. Please try again.',
			notFoundMessage: 'Booking not found or already cancelled/completed.',
			successMessage: 'Booking cancelled.'
		}),

	complete: async ({ params, locals }) =>
		transitionBookingStatus(locals.supabase, params.id, {
			to: 'completed',
			fromAnyOf: ['confirmed'],
			genericErrorMessage: 'Could not complete the booking. Please try again.',
			notFoundMessage: 'Booking not found or not confirmed.',
			successMessage: 'Booking marked completed.'
		})
};
