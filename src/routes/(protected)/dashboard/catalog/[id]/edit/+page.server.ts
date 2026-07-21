import { error, fail } from '@sveltejs/kit';
import { catalogItemFromRow, type CatalogItemRow } from '$lib/catalog/types';
import { parseCatalogItemForm } from '$lib/server/catalog';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { data, error: loadError } = await locals.supabase
		.from('catalog_items')
		.select('id, name, description, price_cents, material_type, status')
		.eq('id', params.id)
		.maybeSingle();

	if (loadError) {
		console.error('catalog: failed to load item', loadError);
		error(500, 'Could not load this item.');
	}

	// RLS silently excludes another organization's item rather than erroring —
	// a null row means "not found or not yours," both reported as 404.
	if (!data) {
		error(404, 'Item not found');
	}

	return { item: catalogItemFromRow(data as CatalogItemRow) };
};

export const actions: Actions = {
	update: async ({ request, params, locals }) => {
		const formData = await request.formData();
		const parsed = parseCatalogItemForm(formData);
		if (!parsed.ok) {
			return fail(400, { message: parsed.message });
		}

		const { data, error: updateError } = await locals.supabase
			.from('catalog_items')
			.update({
				name: parsed.value.name,
				description: parsed.value.description,
				price_cents: parsed.value.priceCents,
				material_type: parsed.value.materialType
			})
			.eq('id', params.id)
			.select('id')
			.maybeSingle();

		if (updateError) {
			return fail(500, { message: 'Could not save the item. Please try again.' });
		}
		if (!data) {
			return fail(404, { message: 'Item not found.' });
		}

		return { success: true, message: 'Item saved.' };
	},

	archive: async ({ params, locals }) => {
		const { data, error: updateError } = await locals.supabase
			.from('catalog_items')
			.update({ status: 'archived' })
			.eq('id', params.id)
			.select('id')
			.maybeSingle();

		if (updateError) {
			return fail(500, { message: 'Could not archive the item. Please try again.' });
		}
		if (!data) {
			return fail(404, { message: 'Item not found.' });
		}

		return { success: true, message: 'Item archived.' };
	},

	unarchive: async ({ params, locals }) => {
		const { data, error: updateError } = await locals.supabase
			.from('catalog_items')
			.update({ status: 'draft' })
			.eq('id', params.id)
			.select('id')
			.maybeSingle();

		if (updateError) {
			return fail(500, { message: 'Could not restore the item. Please try again.' });
		}
		if (!data) {
			return fail(404, { message: 'Item not found.' });
		}

		return { success: true, message: 'Item restored to draft.' };
	}
};
