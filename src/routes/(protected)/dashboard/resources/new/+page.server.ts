import { fail, redirect } from '@sveltejs/kit';
import { parseResourceForm } from '$lib/server/resources';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const formData = await request.formData();
		const parsed = parseResourceForm(formData);
		if (!parsed.ok) {
			return fail(400, { message: parsed.message });
		}

		// organization_id defaults to the caller's own organization (see the
		// resources migration) — never accepted from the client. resource_type
		// is fixed at 'inventory-unit' — this slice never populates 'provider'
		// (bookings spec's Domain model / ADR-0006).
		const { data: created, error } = await locals.supabase
			.from('resources')
			.insert({
				resource_type: 'inventory-unit',
				name: parsed.value.name,
				description: parsed.value.description,
				departure_date: parsed.value.departureDate,
				return_date: parsed.value.returnDate,
				price_cents: parsed.value.priceCents,
				quantity: parsed.value.quantity,
				requires_manual_confirmation: parsed.value.requiresManualConfirmation,
				category: parsed.value.category,
				region: parsed.value.region,
				highlights: parsed.value.highlights
			})
			.select('id')
			.single();

		if (error || !created) {
			return fail(500, { message: 'Could not create the resource. Please try again.' });
		}

		throw redirect(303, '/dashboard/resources');
	}
};
