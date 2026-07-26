import { fail, redirect } from '@sveltejs/kit';
import { resourceFromRow, type ResourceRow } from '$lib/bookings/types';
import { customerFromRow, type CustomerRow } from '$lib/customers/types';
import { parseManualBookingForm } from '$lib/server/bookings';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const [resourcesResult, customersResult] = await Promise.all([
		locals.supabase
			.from('resources')
			.select(
				'id, name, description, departure_date, return_date, quantity, requires_manual_confirmation, price_cents, status'
			)
			.order('departure_date', { ascending: true }),
		locals.supabase
			.from('customers')
			.select('id, full_name, email, phone, custom_fields, source, status')
			.order('created_at', { ascending: false })
	]);

	if (resourcesResult.error) {
		console.error('bookings: failed to load resources', resourcesResult.error);
	}
	if (customersResult.error) {
		console.error('bookings: failed to load customers', customersResult.error);
	}

	return {
		resources: resourcesResult.data
			? (resourcesResult.data as ResourceRow[]).map(resourceFromRow)
			: [],
		customers: customersResult.data
			? (customersResult.data as CustomerRow[]).map(customerFromRow)
			: []
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const formData = await request.formData();
		const parsed = parseManualBookingForm(formData);
		if (!parsed.ok) {
			return fail(400, { message: parsed.message });
		}

		// start_at/end_at always come from the resource's own dates, never
		// independently chosen — same rule as the public submission path
		// (Bookings #43). Re-fetched here, not trusted from anything the
		// client sent about the resource beyond its id.
		const { data: resource, error: resourceError } = await locals.supabase
			.from('resources')
			.select('departure_date, return_date')
			.eq('id', parsed.value.resourceId)
			.maybeSingle();

		if (resourceError) {
			return fail(500, { message: 'Could not log the booking. Please try again.' });
		}
		if (!resource) {
			return fail(400, { message: 'Select a valid package.' });
		}

		const { error: insertError } = await locals.supabase.from('bookings').insert({
			resource_id: parsed.value.resourceId,
			customer_id: parsed.value.customerId,
			traveler_count: parsed.value.travelerCount,
			notes: parsed.value.notes,
			start_at: resource.departure_date,
			end_at: resource.return_date,
			status: 'pending'
		});

		if (insertError) {
			return fail(500, { message: 'Could not log the booking. Please try again.' });
		}

		throw redirect(303, '/dashboard/bookings');
	}
};
