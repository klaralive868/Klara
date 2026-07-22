import { fail } from '@sveltejs/kit';
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
	createTopLevel: async ({ request, locals }) => {
		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();
		if (!name) {
			return fail(400, { message: 'Enter a category name.' });
		}

		const { error } = await locals.supabase.from('catalog_categories').insert({ name });
		if (error) {
			return fail(500, { message: 'Could not create the category. Please try again.' });
		}

		return { success: true };
	},

	createSubcategory: async ({ request, locals }) => {
		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();
		const parentId = String(formData.get('parentId') ?? '').trim();
		if (!name || !parentId) {
			return fail(400, { message: 'Enter a subcategory name.' });
		}

		const { error } = await locals.supabase
			.from('catalog_categories')
			.insert({ name, parent_id: parentId });
		if (error) {
			// The depth/ownership trigger raises a clear Postgres exception, but
			// its detail isn't meant for end users — a generic message here is
			// deliberate (the UI only ever offers a genuinely top-level parent).
			return fail(400, { message: 'Could not create the subcategory. Please try again.' });
		}

		return { success: true };
	},

	rename: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		const name = String(formData.get('name') ?? '').trim();
		if (!id || !name) {
			return fail(400, { message: 'Enter a category name.' });
		}

		const { data, error } = await locals.supabase
			.from('catalog_categories')
			.update({ name })
			.eq('id', id)
			.select('id')
			.maybeSingle();

		if (error) {
			return fail(500, { message: 'Could not rename the category. Please try again.' });
		}
		if (!data) {
			return fail(404, { message: 'Category not found.' });
		}

		return { success: true };
	},

	delete: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) {
			return fail(400, { message: 'Missing category id.' });
		}

		const { error } = await locals.supabase.from('catalog_categories').delete().eq('id', id);
		if (error) {
			return fail(500, { message: 'Could not delete the category. Please try again.' });
		}

		return { success: true };
	}
};
