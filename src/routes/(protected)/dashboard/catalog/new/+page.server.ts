import { fail, redirect } from '@sveltejs/kit';
import { parseCatalogItemForm } from '$lib/server/catalog';
import { catalogCategoryFromRow, type CatalogCategoryRow } from '$lib/catalog/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { data, error } = await locals.supabase
		.from('catalog_categories')
		.select('id, name, parent_id')
		.order('created_at', { ascending: true });

	if (error) {
		console.error('catalog: failed to load categories', error);
		return { categories: [] };
	}

	return { categories: (data as CatalogCategoryRow[]).map(catalogCategoryFromRow) };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const formData = await request.formData();
		const parsed = parseCatalogItemForm(formData);
		if (!parsed.ok) {
			return fail(400, { message: parsed.message });
		}

		const categoryIds = formData.getAll('categoryIds').map(String);

		// organization_id defaults to the caller's own organization (see the
		// catalog_items migration) — never accepted from the client.
		const { data: created, error } = await locals.supabase
			.from('catalog_items')
			.insert({
				name: parsed.value.name,
				description: parsed.value.description,
				price_cents: parsed.value.priceCents,
				material_type: parsed.value.materialType
			})
			.select('id')
			.single();

		if (error || !created) {
			return fail(500, { message: 'Could not create the item. Please try again.' });
		}

		if (categoryIds.length > 0) {
			const { error: tagError } = await locals.supabase
				.from('catalog_item_categories')
				.insert(
					categoryIds.map((categoryId) => ({ item_id: created.id, category_id: categoryId }))
				);
			if (tagError) {
				// The item itself was created successfully — only the tagging
				// failed. Not worth failing the whole creation over; the item is
				// reachable from the list and its categories can be fixed there.
				console.error('catalog: failed to tag new item with categories', tagError);
			}
		}

		throw redirect(303, '/dashboard/catalog');
	}
};
