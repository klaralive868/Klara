import { catalogItemFromRow, type CatalogItemRow } from '$lib/catalog/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { data, error } = await locals.supabase
		.from('catalog_items')
		.select('id, name, description, price_cents, material_type, status')
		.order('created_at', { ascending: false });

	if (error) {
		// RLS already scopes this to the caller's own organization — a query
		// error here is unexpected infra failure, not an access-control gap.
		console.error('catalog: failed to load items', error);
		return { items: [] };
	}

	return { items: (data as CatalogItemRow[]).map(catalogItemFromRow) };
};
