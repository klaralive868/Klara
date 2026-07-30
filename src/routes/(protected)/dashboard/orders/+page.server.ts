import { ORDER_SELECT, orderFromRow, type OrderRow } from '$lib/orders/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// RLS already scopes this to the caller's own organization — a query
	// error here is unexpected infra failure, not an access-control gap
	// (same reasoning as the catalog list loader).
	const { data, error } = await locals.supabase
		.from('orders')
		.select(ORDER_SELECT)
		.order('created_at', { ascending: false });

	if (error) {
		console.error('orders: failed to load orders', error);
		return { orders: [] };
	}

	return { orders: (data as unknown as OrderRow[]).map(orderFromRow) };
};
