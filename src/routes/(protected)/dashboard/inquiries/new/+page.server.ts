import { customerFromRow, type CustomerRow } from '$lib/customers/types';
import type { PageServerLoad } from './$types';

// The customer picker is real (Bookings #44 wired it to the customers
// table); everything else on this page is still placeholder-only per this
// ticket (#45) — inquiries themselves have no table yet, that's #48's job.
export const load: PageServerLoad = async ({ locals }) => {
	const { data, error } = await locals.supabase
		.from('customers')
		.select('id, full_name, email, phone, custom_fields, source, status')
		.order('created_at', { ascending: false });

	if (error) {
		console.error('inquiries: failed to load customers', error);
		return { customers: [] };
	}

	return { customers: (data as CustomerRow[]).map(customerFromRow) };
};
