import { customerFromRow, type CustomerRow } from '$lib/customers/types';
import { loadActiveFieldDefinitions } from '$lib/server/field-definitions';
import type { PageServerLoad } from './$types';

const ENTITY_TYPE = 'customer';

export const load: PageServerLoad = async ({ locals }) => {
	// RLS scopes this to the caller's organization_id — no client-supplied
	// org id is ever accepted (Standards §2).
	const [customersResult, fieldDefinitions] = await Promise.all([
		locals.supabase
			.from('customers')
			.select('id, full_name, email, phone, custom_fields, source, status')
			.order('created_at', { ascending: false }),
		loadActiveFieldDefinitions(locals.supabase, ENTITY_TYPE)
	]);

	if (customersResult.error) {
		console.error('customers: failed to load customers', customersResult.error);
		return { customers: [], fieldDefinitions: [] };
	}

	return {
		customers: (customersResult.data as CustomerRow[]).map(customerFromRow),
		fieldDefinitions
	};
};
