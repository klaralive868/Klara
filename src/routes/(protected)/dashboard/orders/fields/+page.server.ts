import { fail } from '@sveltejs/kit';
import {
	addCustomField,
	loadFieldsForManagement,
	parseAddFieldForm,
	setFieldActive
} from '$lib/server/field-definitions';
import type { Actions, PageServerLoad } from './$types';

const ENTITY_TYPE = 'order';

export const load: PageServerLoad = async ({ locals }) => {
	return { fields: await loadFieldsForManagement(locals.supabase, ENTITY_TYPE) };
};

// No toggleCoreField action — Orders has no whitelisted core fields
// (ADR-0011: every existing Orders column is structurally intrinsic, not
// optional business data), so ManageFieldsPanel's "Core fields" section
// renders empty for this entity_type and never submits that action.
export const actions: Actions = {
	toggleCustomField: async ({ request, locals }) => {
		const formData = await request.formData();
		const fieldId = String(formData.get('fieldId') ?? '');
		const active = formData.get('active') === 'true';

		if (!fieldId) {
			return fail(400, { message: 'Missing field.' });
		}

		const result = await setFieldActive(locals.supabase, ENTITY_TYPE, fieldId, active);
		if (!result.ok) {
			return fail(400, { message: result.message });
		}
		return { message: active ? 'Field shown.' : 'Field hidden.' };
	},

	addCustomField: async ({ request, locals }) => {
		const formData = await request.formData();
		const parsed = parseAddFieldForm(formData);
		if (!parsed.ok) {
			return fail(400, { message: parsed.message });
		}

		const result = await addCustomField(locals.supabase, ENTITY_TYPE, parsed.value);
		if (!result.ok) {
			return fail(400, { message: result.message });
		}
		return { message: `${parsed.value.label} added.` };
	}
};
