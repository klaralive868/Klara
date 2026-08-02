import { error, fail } from '@sveltejs/kit';
import { parseCustomerForm } from '$lib/server/customers';
import { loadActiveFieldDefinitions } from '$lib/server/field-definitions';
import { customerFromRow, type CustomerRow } from '$lib/customers/types';
import type { Actions, PageServerLoad } from './$types';

const ENTITY_TYPE = 'customer';

export const load: PageServerLoad = async ({ params, locals }) => {
	const [customerResult, fieldDefinitions] = await Promise.all([
		locals.supabase
			.from('customers')
			.select('id, full_name, email, phone, custom_fields, source, status')
			.eq('id', params.id)
			.maybeSingle(),
		loadActiveFieldDefinitions(locals.supabase, ENTITY_TYPE)
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

	return {
		customer: customerFromRow(customerResult.data as CustomerRow),
		fieldDefinitions
	};
};

export const actions: Actions = {
	update: async ({ request, params, locals }) => {
		const fieldDefinitions = await loadActiveFieldDefinitions(locals.supabase, ENTITY_TYPE);

		const formData = await request.formData();
		const parsed = parseCustomerForm(formData, fieldDefinitions);
		if (!parsed.ok) {
			return fail(400, { message: parsed.message });
		}

		// custom_fields is merged, not replaced wholesale: a value for a key
		// that's no longer an active field definition (renamed, or soft-hidden
		// via the fields management page since this customer was last saved)
		// must survive this save untouched — that's the whole point of
		// soft-hide (ADR-0011) and of custom_fields having no DB constraint
		// tying it to the current registry. Only keys belonging to a
		// *currently active* field definition are replaced — stripping them
		// all out before overlaying parsed.value.customFields is what lets a
		// still-active optional field actually be cleared by leaving it
		// blank, rather than the stale value lingering because a blank field
		// is omitted from the parsed result entirely.
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

		const activeCustomFieldKeys = new Set(
			fieldDefinitions.filter((def) => !def.isCore).map((def) => def.fieldKey)
		);
		const preservedFields = Object.fromEntries(
			Object.entries((existing.custom_fields ?? {}) as Record<string, unknown>).filter(
				([key]) => !activeCustomFieldKeys.has(key)
			)
		);
		const mergedCustomFields = { ...preservedFields, ...parsed.value.customFields };

		// coreValues only contains a key for a currently-active is_core field
		// (email/phone) — an inactive one is never included here, so it's
		// never included in this update payload either, leaving its existing
		// column value untouched (same soft-hide guarantee as custom_fields
		// above, just via omission-from-the-update rather than a jsonb merge,
		// since these are real typed columns).
		const { error: updateError } = await locals.supabase
			.from('customers')
			.update({
				full_name: parsed.value.fullName,
				custom_fields: mergedCustomFields,
				...parsed.value.coreValues
			})
			.eq('id', params.id);

		if (updateError) {
			return fail(500, { message: 'Could not save the customer. Please try again.' });
		}

		return { success: true, message: 'Customer saved.' };
	}
};
