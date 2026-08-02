import { fail } from '@sveltejs/kit';
import {
	addCustomField,
	loadFieldsForManagement,
	parseAddFieldForm,
	setCoreFieldActive,
	setFieldActive
} from '$lib/server/field-definitions';
import type { Actions, PageServerLoad } from './$types';

const ENTITY_TYPE = 'customer';

export const load: PageServerLoad = async ({ locals }) => {
	return { fields: await loadFieldsForManagement(locals.supabase, ENTITY_TYPE) };
};

export const actions: Actions = {
	toggleCoreField: async ({ request, locals }) => {
		const formData = await request.formData();
		const fieldKey = String(formData.get('fieldKey') ?? '');
		const active = formData.get('active') === 'true';

		const result = await setCoreFieldActive(locals.supabase, ENTITY_TYPE, fieldKey, active);
		if (!result.ok) {
			return fail(400, { message: result.message });
		}
		return { message: active ? `${fieldKey} shown.` : `${fieldKey} hidden.` };
	},

	toggleCustomField: async ({ request, locals }) => {
		const formData = await request.formData();
		const fieldId = String(formData.get('fieldId') ?? '');
		const active = formData.get('active') === 'true';

		if (!fieldId) {
			return fail(400, { message: 'Missing field.' });
		}

		const result = await setFieldActive(locals.supabase, fieldId, active);
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
