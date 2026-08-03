import { fail, redirect } from '@sveltejs/kit';
import { parseCustomerForm } from '$lib/server/customers';
import { loadActiveFieldDefinitions } from '$lib/server/field-definitions';
import type { Actions, PageServerLoad } from './$types';

const ENTITY_TYPE = 'customer';

export const load: PageServerLoad = async ({ locals }) => {
	return { fieldDefinitions: await loadActiveFieldDefinitions(locals.supabase, ENTITY_TYPE) };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		// Re-fetched here, not trusted from the submitted form — a tampered
		// request could otherwise omit a required field's constraint or claim
		// a field is a different type than the organization actually defined
		// (Standards §8/§9: server-side validation is non-negotiable).
		const fieldDefinitions = await loadActiveFieldDefinitions(locals.supabase, ENTITY_TYPE);

		const formData = await request.formData();
		const parsed = parseCustomerForm(formData, fieldDefinitions);
		if (!parsed.ok) {
			return fail(400, { message: parsed.message });
		}

		// organization_id defaults to the caller's own organization (see the
		// customers migration) — never accepted from the client. source
		// defaults to 'manual' via the table default, matching this form.
		// coreValues only ever contains keys for active is_core fields
		// (email/phone) — spread directly, since an absent key here means the
		// column simply keeps its (null, on insert) default rather than
		// needing special-casing.
		const { error } = await locals.supabase.from('customers').insert({
			full_name: parsed.value.fullName,
			custom_fields: parsed.value.customFields,
			...parsed.value.coreValues
		});

		if (error) {
			// 23505 here can only be customers_organization_id_email_lower_key
			// (the other unique constraints on this table are keyed off ids,
			// not submitted data) — a customer with this email (any casing)
			// already exists in this organization. That's an ordinary,
			// expected outcome of a duplicate submission, not a server
			// failure, so it gets a field-validation-style message instead
			// of the generic 500 every other insert failure falls back to.
			if (error.code === '23505') {
				return fail(400, {
					message: 'A customer with this email already exists in your organization.'
				});
			}
			return fail(500, { message: 'Could not create the customer. Please try again.' });
		}

		throw redirect(303, '/dashboard/customers');
	}
};
