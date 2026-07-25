import { resourceFromRow, type ResourceRow } from '$lib/bookings/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { data, error } = await locals.supabase
		.from('resources')
		.select(
			'id, name, description, departure_date, return_date, quantity, requires_manual_confirmation, price_cents, status'
		)
		.order('created_at', { ascending: true });

	if (error) {
		console.error('resources: failed to load resources', error);
		return { resources: [] };
	}

	return { resources: (data as ResourceRow[]).map(resourceFromRow) };
};
