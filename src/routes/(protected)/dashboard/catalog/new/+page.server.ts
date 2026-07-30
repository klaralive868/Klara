import { fail, redirect } from '@sveltejs/kit';
import { parseCatalogItemForm, parseStockQuantities } from '$lib/server/catalog';
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
		const stockEntries = parseStockQuantities(formData.get('stockQuantities') as string | null);

		// organization_id defaults to the caller's own organization (see the
		// catalog_items migration) — never accepted from the client.
		const { data: created, error } = await locals.supabase
			.from('catalog_items')
			.insert({
				name: parsed.value.name,
				description: parsed.value.description,
				price_cents: parsed.value.priceCents,
				material_type: parsed.value.materialType,
				unlimited_stock: parsed.value.unlimitedStock
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

		if (stockEntries.length > 0) {
			const { error: stockError } = await locals.supabase.rpc('sync_catalog_item_stock', {
				p_item_id: created.id,
				p_entries: stockEntries
			});
			if (stockError) {
				// Same reasoning as the category-tagging failure above — the item
				// itself was created; stock can be fixed from the edit screen.
				console.error('catalog: failed to set stock for new item', stockError);
			}
		}

		throw redirect(303, '/dashboard/catalog');
	}
};
