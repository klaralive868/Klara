import { fail, redirect } from '@sveltejs/kit';
import { customerFromRow, type CustomerRow } from '$lib/customers/types';
import { parseManualInquiryForm } from '$lib/server/inquiries';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { data, error } = await locals.supabase
		.from('customers')
		.select('id, full_name, email, phone, custom_fields, source, status')
		.order('created_at', { ascending: false });

	if (error) {
		console.error('inquiries: failed to load customers', error);
		return { customers: [] };
	}

	return { customers: (data as CustomerRow[]).map(customerFromRow) };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const formData = await request.formData();
		const parsed = parseManualInquiryForm(formData);
		if (!parsed.ok) {
			return fail(400, { message: parsed.message });
		}

		// Always logged 'new' — matches the table default and the same
		// "a manual entry is a request, not a decision" rule bookings/#43
		// applies to public submissions.
		const { error: insertError } = await locals.supabase.from('travel_inquiries').insert({
			customer_id: parsed.value.customerId,
			trip_description: parsed.value.tripDescription,
			preferred_dates: parsed.value.preferredDates,
			party_size: parsed.value.partySize,
			budget: parsed.value.budget,
			notes: parsed.value.notes,
			status: 'new'
		});

		if (insertError) {
			return fail(500, { message: 'Could not log the inquiry. Please try again.' });
		}

		throw redirect(303, '/dashboard/inquiries');
	}
};
