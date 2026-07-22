import { error, fail } from '@sveltejs/kit';
import {
	catalogCategoryFromRow,
	catalogItemFromRow,
	type CatalogCategoryRow,
	type CatalogItemRow
} from '$lib/catalog/types';
import { parseCatalogItemForm } from '$lib/server/catalog';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const [itemResult, categoriesResult, tagsResult] = await Promise.all([
		locals.supabase
			.from('catalog_items')
			.select('id, name, description, price_cents, material_type, status')
			.eq('id', params.id)
			.maybeSingle(),
		locals.supabase
			.from('catalog_categories')
			.select('id, name, parent_id')
			.order('created_at', { ascending: true }),
		locals.supabase.from('catalog_item_categories').select('category_id').eq('item_id', params.id)
	]);

	if (itemResult.error) {
		console.error('catalog: failed to load item', itemResult.error);
		error(500, 'Could not load this item.');
	}

	// RLS silently excludes another organization's item rather than erroring —
	// a null row means "not found or not yours," both reported as 404.
	if (!itemResult.data) {
		error(404, 'Item not found');
	}

	if (categoriesResult.error) {
		console.error('catalog: failed to load categories', categoriesResult.error);
	}
	if (tagsResult.error) {
		console.error('catalog: failed to load item categories', tagsResult.error);
	}

	return {
		item: catalogItemFromRow(itemResult.data as CatalogItemRow),
		categories: ((categoriesResult.data ?? []) as CatalogCategoryRow[]).map(catalogCategoryFromRow),
		categoryIds: (tagsResult.data ?? []).map((row) => row.category_id as string)
	};
};

export const actions: Actions = {
	update: async ({ request, params, locals }) => {
		const formData = await request.formData();
		const parsed = parseCatalogItemForm(formData);
		if (!parsed.ok) {
			return fail(400, { message: parsed.message });
		}

		const categoryIds = formData.getAll('categoryIds').map(String);

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

		// A single RPC call, not two separate delete/insert requests — the
		// function wraps both in one transaction, so a failed insert can't
		// leave the item with its tags deleted and nothing re-applied.
		const { error: tagError } = await locals.supabase.rpc('sync_catalog_item_categories', {
			p_item_id: params.id,
			p_category_ids: categoryIds
		});
		if (tagError) {
			console.error('catalog: failed to sync item categories', tagError);
			return fail(500, { message: 'Item saved, but categories could not be updated.' });
		}

		return { success: true, message: 'Item saved.' };
	},

	publish: async ({ request, params, locals }) => {
		// The categories checked in the form when Publish is clicked are what
		// gate publishing — reading them here (rather than only the DB's prior
		// state) means checking a category and clicking Publish directly
		// (without clicking Save item first) isn't silently discarded.
		const formData = await request.formData();
		const categoryIds = formData.getAll('categoryIds').map(String);

		// Checked before syncing — the item's existing tags must survive an
		// unpublishable (zero-category) attempt untouched, not be wiped by the
		// sync's delete before this guard ever runs.
		if (categoryIds.length === 0) {
			return fail(400, { message: 'Add at least one category before publishing.' });
		}

		const { error: tagError } = await locals.supabase.rpc('sync_catalog_item_categories', {
			p_item_id: params.id,
			p_category_ids: categoryIds
		});
		if (tagError) {
			return fail(500, { message: 'Could not publish the item. Please try again.' });
		}

		// Only a genuinely draft item can be published directly — mirrors the
		// same status-precondition pattern as unarchive, so a direct POST can't
		// force an unexpected transition.
		const { data, error: updateError } = await locals.supabase
			.from('catalog_items')
			.update({ status: 'published' })
			.eq('id', params.id)
			.eq('status', 'draft')
			.select('id')
			.maybeSingle();

		if (updateError) {
			return fail(500, { message: 'Could not publish the item. Please try again.' });
		}
		if (!data) {
			return fail(404, { message: 'Item not found or not a draft.' });
		}

		return { success: true, message: 'Item published.' };
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
		// Only a genuinely archived item can be unarchived — without this,
		// a direct POST to a published item would silently demote it to draft
		// (the UI only ever renders this button for archived items).
		const { data, error: updateError } = await locals.supabase
			.from('catalog_items')
			.update({ status: 'draft' })
			.eq('id', params.id)
			.eq('status', 'archived')
			.select('id')
			.maybeSingle();

		if (updateError) {
			return fail(500, { message: 'Could not restore the item. Please try again.' });
		}
		if (!data) {
			return fail(404, { message: 'Item not found or not archived.' });
		}

		return { success: true, message: 'Item restored to draft.' };
	}
};
