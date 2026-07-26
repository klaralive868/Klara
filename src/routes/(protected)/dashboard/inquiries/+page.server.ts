import { error } from '@sveltejs/kit';
import { TRAVEL_INQUIRY_SELECT, travelInquiryFromRow, type TravelInquiryRow } from '$lib/bookings/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { data, error: loadError } = await locals.supabase
		.from('travel_inquiries')
		.select(TRAVEL_INQUIRY_SELECT)
		.order('created_at', { ascending: false });

	if (loadError) {
		// A real fetch failure (DB down, schema drift, network) is not the
		// same thing as "this organization genuinely has zero inquiries" —
		// swallowing it into an empty list would show "No inquiries yet" for
		// what's actually a broken page.
		console.error('inquiries: failed to load inquiries', loadError);
		error(500, 'Could not load inquiries.');
	}

	return { inquiries: (data as unknown as TravelInquiryRow[]).map(travelInquiryFromRow) };
};
