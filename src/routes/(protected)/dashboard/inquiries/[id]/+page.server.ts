import { error } from '@sveltejs/kit';
import { getPlaceholderInquiry } from '$lib/bookings/placeholder-inquiries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const inquiry = getPlaceholderInquiry(params.id);
	if (!inquiry) {
		error(404, 'Inquiry not found');
	}
	return { inquiry };
};
