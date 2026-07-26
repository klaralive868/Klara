import { TRAVEL_INQUIRY_SELECT, travelInquiryFromRow, type TravelInquiryRow } from '$lib/bookings/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { data, error } = await locals.supabase
		.from('travel_inquiries')
		.select(TRAVEL_INQUIRY_SELECT)
		.order('created_at', { ascending: false });

	if (error) {
		console.error('inquiries: failed to load inquiries', error);
		return { inquiries: [] };
	}

	return { inquiries: (data as unknown as TravelInquiryRow[]).map(travelInquiryFromRow) };
};
