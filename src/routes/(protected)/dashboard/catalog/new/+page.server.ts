import { fail, redirect } from '@sveltejs/kit';
import { parseCatalogItemForm } from '$lib/server/catalog';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const formData = await request.formData();
		const parsed = parseCatalogItemForm(formData);
		if (!parsed.ok) {
			return fail(400, { message: parsed.message });
		}

		// organization_id defaults to the caller's own organization (see the
		// catalog_items migration) — never accepted from the client.
		const { error } = await locals.supabase.from('catalog_items').insert({
			name: parsed.value.name,
			description: parsed.value.description,
			price_cents: parsed.value.priceCents,
			material_type: parsed.value.materialType
		});

		if (error) {
			return fail(500, { message: 'Could not create the item. Please try again.' });
		}

		throw redirect(303, '/dashboard/catalog');
	}
};
