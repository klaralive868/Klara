import { error, fail } from '@sveltejs/kit';
import { parseCustomerForm } from '$lib/server/customers';
import {
	customerFieldDefinitionFromRow,
	customerFromRow,
	type CustomerFieldDefinitionRow,
	type CustomerRow
} from '$lib/customers/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const [customerResult, defsResult] = await Promise.all([
		locals.supabase
			.from('customers')
			.select('id, full_name, email, phone, custom_fields, source, status')
			.eq('id', params.id)
			.maybeSingle(),
		locals.supabase
			.from('customer_field_definitions')
			.select('id, field_key, label, field_type, options, required, display_order')
			.order('display_order', { ascending: true })
	]);

	if (customerResult.error) {
		console.error('customers: failed to load customer', customerResult.error);
		error(500, 'Could not load this customer.');
	}

	// RLS silently excludes another organization's customer rather than
	// erroring — a null row means "not found or not yours," both reported
	// as 404. This is the application-layer half of the cross-org denial
	// (RLS is the actual enforcement — see supabase/tests/0010 — this is
	// defense-in-depth surfacing it as a normal 404, not a leaked 500).
	if (!customerResult.data) {
		error(404, 'Customer not found');
	}

	if (defsResult.error) {
		console.error('customers: failed to load field definitions', defsResult.error);
	}

	return {
		customer: customerFromRow(customerResult.data as CustomerRow),
		fieldDefinitions: ((defsResult.data ?? []) as CustomerFieldDefinitionRow[]).map(
			customerFieldDefinitionFromRow
		)
	};
};

export const actions: Actions = {
	update: async ({ request, params, locals }) => {
		const { data: defsData, error: defsError } = await locals.supabase
			.from('customer_field_definitions')
			.select('id, field_key, label, field_type, options, required, display_order')
			.order('display_order', { ascending: true });
		if (defsError) {
			console.error('customers: failed to load field definitions for validation', defsError);
			return fail(500, { message: 'Could not save the customer. Please try again.' });
		}
		const fieldDefinitions = (defsData as CustomerFieldDefinitionRow[]).map(
			customerFieldDefinitionFromRow
		);

		const formData = await request.formData();
		const parsed = parseCustomerForm(formData, fieldDefinitions);
		if (!parsed.ok) {
			return fail(400, { message: parsed.message });
		}

		// custom_fields is merged, not replaced wholesale: a value for a key
		// that's no longer in fieldDefinitions (the field was renamed/removed
		// from the registry since this customer was last saved) must survive
		// this save untouched — that's the whole point of the migration's "no
		// DB constraint ties custom_fields to the current registry" design.
		// Only keys belonging to a *current* field definition are replaced —
		// stripping them all out before overlaying parsed.value.customFields
		// is what lets a still-defined optional field actually be cleared by
		// leaving it blank, rather than the stale value lingering because a
		// blank field is omitted from the parsed result entirely.
		const { data: existing, error: fetchError } = await locals.supabase
			.from('customers')
			.select('custom_fields')
			.eq('id', params.id)
			.maybeSingle();

		if (fetchError) {
			return fail(500, { message: 'Could not save the customer. Please try again.' });
		}
		// RLS scopes this SELECT to the caller's organization — a foreign id
		// matches zero rows rather than erroring, same "not found or not
		// yours" shape as the load above.
		if (!existing) {
			return fail(404, { message: 'Customer not found.' });
		}

		const currentFieldKeys = new Set(fieldDefinitions.map((def) => def.fieldKey));
		const preservedFields = Object.fromEntries(
			Object.entries((existing.custom_fields ?? {}) as Record<string, unknown>).filter(
				([key]) => !currentFieldKeys.has(key)
			)
		);
		const mergedCustomFields = { ...preservedFields, ...parsed.value.customFields };

		const { error: updateError } = await locals.supabase
			.from('customers')
			.update({
				full_name: parsed.value.fullName,
				email: parsed.value.email,
				phone: parsed.value.phone,
				custom_fields: mergedCustomFields
			})
			.eq('id', params.id);

		if (updateError) {
			return fail(500, { message: 'Could not save the customer. Please try again.' });
		}

		return { success: true, message: 'Customer saved.' };
	}
};
