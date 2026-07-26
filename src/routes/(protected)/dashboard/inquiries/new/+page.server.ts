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

// Raw (unparsed) form values to hand back on failure — a plain
// method="POST" submission is a full page navigation, so nothing in the
// component's local $state survives a failed attempt on its own. Kept
// separate from ParsedManualInquiryForm since these are pre-validation
// strings straight off the form, not the parsed/typed result.
function submittedValues(formData: FormData) {
	return {
		customerId: String(formData.get('customerId') ?? ''),
		tripDescription: String(formData.get('tripDescription') ?? ''),
		preferredDates: String(formData.get('preferredDates') ?? ''),
		partySize: String(formData.get('partySize') ?? ''),
		budget: String(formData.get('budget') ?? ''),
		notes: String(formData.get('notes') ?? '')
	};
}

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const formData = await request.formData();
		const values = submittedValues(formData);
		const parsed = parseManualInquiryForm(formData);
		if (!parsed.ok) {
			return fail(400, { message: parsed.message, values });
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
			return fail(500, { message: 'Could not log the inquiry. Please try again.', values });
		}

		throw redirect(303, '/dashboard/inquiries');
	}
};
