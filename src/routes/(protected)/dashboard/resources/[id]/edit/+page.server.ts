import { error, fail } from '@sveltejs/kit';
import { resourceFromRow, type ResourceRow } from '$lib/bookings/types';
import { parseResourceForm } from '$lib/server/resources';
import { getResourceSeatCounts } from '$lib/server/bookings';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { data, error: loadError } = await locals.supabase
		.from('resources')
		.select(
			'id, name, description, departure_date, return_date, quantity, requires_manual_confirmation, price_cents, status'
		)
		.eq('id', params.id)
		.maybeSingle();

	if (loadError) {
		console.error('resources: failed to load resource', loadError);
		error(500, 'Could not load this resource.');
	}

	// RLS silently excludes another organization's resource rather than
	// erroring — a null row means "not found or not yours," both 404.
	if (!data) {
		error(404, 'Resource not found');
	}

	const resource = resourceFromRow(data as ResourceRow);

	// Only meaningful when a seat limit is actually set — an uncapped
	// resource has nothing for these counts to track against.
	const seatCounts =
		resource.quantity !== null ? await getResourceSeatCounts(locals.supabase, resource.id) : null;

	return { resource, seatCounts };
};

export const actions: Actions = {
	update: async ({ request, params, locals }) => {
		const formData = await request.formData();
		const parsed = parseResourceForm(formData);
		if (!parsed.ok) {
			return fail(400, { message: parsed.message });
		}

		const { data, error: updateError } = await locals.supabase
			.from('resources')
			.update({
				name: parsed.value.name,
				description: parsed.value.description,
				departure_date: parsed.value.departureDate,
				return_date: parsed.value.returnDate,
				price_cents: parsed.value.priceCents,
				quantity: parsed.value.quantity,
				requires_manual_confirmation: parsed.value.requiresManualConfirmation
			})
			.eq('id', params.id)
			.select('id')
			.maybeSingle();

		if (updateError) {
			return fail(500, { message: 'Could not save the resource. Please try again.' });
		}
		if (!data) {
			return fail(404, { message: 'Resource not found.' });
		}

		return { success: true, message: 'Resource saved.' };
	},

	publish: async ({ params, locals }) => {
		// Only a genuinely draft resource can be published directly — mirrors
		// Catalog's publish precondition (draft -> published only).
		const { data, error: updateError } = await locals.supabase
			.from('resources')
			.update({ status: 'published' })
			.eq('id', params.id)
			.eq('status', 'draft')
			.select('id')
			.maybeSingle();

		if (updateError) {
			return fail(500, { message: 'Could not publish the resource. Please try again.' });
		}
		if (!data) {
			return fail(404, { message: 'Resource not found or not a draft.' });
		}

		return { success: true, message: 'Resource published.' };
	},

	archive: async ({ params, locals }) => {
		// Archive works from either draft or published — no status
		// precondition, mirroring Catalog's archive action.
		const { data, error: updateError } = await locals.supabase
			.from('resources')
			.update({ status: 'archived' })
			.eq('id', params.id)
			.select('id')
			.maybeSingle();

		if (updateError) {
			return fail(500, { message: 'Could not archive the resource. Please try again.' });
		}
		if (!data) {
			return fail(404, { message: 'Resource not found.' });
		}

		return { success: true, message: 'Resource archived.' };
	},

	unarchive: async ({ params, locals }) => {
		// Only a genuinely archived resource can be unarchived — archive is
		// never a dead end, and it always returns to draft (never published).
		const { data, error: updateError } = await locals.supabase
			.from('resources')
			.update({ status: 'draft' })
			.eq('id', params.id)
			.eq('status', 'archived')
			.select('id')
			.maybeSingle();

		if (updateError) {
			return fail(500, { message: 'Could not restore the resource. Please try again.' });
		}
		if (!data) {
			return fail(404, { message: 'Resource not found or not archived.' });
		}

		return { success: true, message: 'Resource restored to draft.' };
	}
};
