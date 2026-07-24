import { customerFromRow, type CustomerRow } from '$lib/customers/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// RLS scopes this to the caller's organization_id — no client-supplied
	// org id is ever accepted (Standards §2).
	const { data, error } = await locals.supabase
		.from('customers')
		.select('id, full_name, email, phone, custom_fields, source, status')
		.order('created_at', { ascending: false });

	if (error) {
		console.error('customers: failed to load customers', error);
		return { customers: [] };
	}

	return { customers: (data as CustomerRow[]).map(customerFromRow) };
};
