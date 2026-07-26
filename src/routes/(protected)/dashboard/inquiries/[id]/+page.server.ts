import { error } from '@sveltejs/kit';
import {
	TRAVEL_INQUIRY_SELECT,
	travelInquiryFromRow,
	type TravelInquiryRow
} from '$lib/bookings/types';
import { transitionStatus } from '$lib/server/status-transition';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { data, error: loadError } = await locals.supabase
		.from('travel_inquiries')
		.select(TRAVEL_INQUIRY_SELECT)
		.eq('id', params.id)
		.maybeSingle();

	if (loadError) {
		console.error('inquiries: failed to load inquiry', loadError);
		error(500, 'Could not load this inquiry.');
	}

	// RLS silently excludes another organization's inquiry rather than
	// erroring — a null row means "not found or not yours," both 404.
	if (!data) {
		error(404, 'Inquiry not found');
	}

	return { inquiry: travelInquiryFromRow(data as unknown as TravelInquiryRow) };
};

export const actions: Actions = {
	startProgress: async ({ params, locals }) =>
		transitionStatus(locals.supabase, 'travel_inquiries', params.id, {
			to: 'in-progress',
			fromAnyOf: ['new'],
			genericErrorMessage: 'Could not update the inquiry. Please try again.',
			notFoundMessage: 'Inquiry not found or not new.',
			successMessage: 'Inquiry marked in progress.'
		}),

	// Convert/close both work from new or in-progress — an agent can convert
	// or close an inquiry without first marking it in-progress, same
	// no-dead-end reasoning as Bookings' cancel action.
	convert: async ({ params, locals }) =>
		transitionStatus(locals.supabase, 'travel_inquiries', params.id, {
			to: 'converted',
			fromAnyOf: ['new', 'in-progress'],
			genericErrorMessage: 'Could not update the inquiry. Please try again.',
			notFoundMessage: 'Inquiry not found or already converted/closed.',
			successMessage: 'Inquiry converted.'
		}),

	close: async ({ params, locals }) =>
		transitionStatus(locals.supabase, 'travel_inquiries', params.id, {
			to: 'closed',
			fromAnyOf: ['new', 'in-progress'],
			genericErrorMessage: 'Could not update the inquiry. Please try again.',
			notFoundMessage: 'Inquiry not found or already converted/closed.',
			successMessage: 'Inquiry closed.'
		})
};
