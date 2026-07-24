import type { CustomerFieldDefinition } from '$lib/customers/types';

export interface ParsedCustomerForm {
	fullName: string;
	email: string | null;
	phone: string | null;
	customFields: Record<string, unknown>;
}

export type ParseCustomerFormResult =
	| { ok: true; value: ParsedCustomerForm }
	| { ok: false; message: string };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Validates the core fields plus every dynamic field described by
// `fieldDefinitions` — the caller-supplied set of field_key/label/type/
// required/options rows for this organization, always re-fetched
// server-side (never trusted from the client) so a tampered submission
// can't skip a required field or smuggle in a value of the wrong shape
// for its type. This is the only place custom_fields values get checked
// against their definition — the DB's custom_fields column is a plain
// jsonb bag with no per-key type constraint (Standards §1: not the kind
// of invariant RLS/CHECK constraints are for).
export function parseCustomerForm(
	formData: FormData,
	fieldDefinitions: readonly CustomerFieldDefinition[]
): ParseCustomerFormResult {
	const fullName = String(formData.get('fullName') ?? '').trim();
	const email = String(formData.get('email') ?? '').trim();
	const phone = String(formData.get('phone') ?? '').trim();

	if (!fullName) {
		return { ok: false, message: 'Enter a name for the customer.' };
	}

	const customFields: Record<string, unknown> = {};
	for (const def of fieldDefinitions) {
		const raw = formData.get(`custom_${def.fieldKey}`);
		const rawText = raw === null ? '' : String(raw).trim();

		if (!rawText) {
			if (def.required) {
				return { ok: false, message: `${def.label} is required.` };
			}
			// Not required and left blank — omitted from custom_fields
			// entirely, not stored as an empty string.
			continue;
		}

		switch (def.fieldType) {
			case 'text':
				customFields[def.fieldKey] = rawText;
				break;

			case 'number': {
				const parsed = Number(rawText);
				if (!Number.isFinite(parsed)) {
					return { ok: false, message: `${def.label} must be a number.` };
				}
				customFields[def.fieldKey] = parsed;
				break;
			}

			case 'date': {
				// <input type="date"> submits YYYY-MM-DD — reject anything else
				// rather than passing it through to a Date constructor, which
				// silently accepts a wide range of ambiguous formats.
				if (!DATE_PATTERN.test(rawText) || Number.isNaN(Date.parse(rawText))) {
					return { ok: false, message: `${def.label} must be a valid date.` };
				}
				customFields[def.fieldKey] = rawText;
				break;
			}

			case 'select': {
				if (!def.options || !def.options.includes(rawText)) {
					return { ok: false, message: `${def.label} must be one of the allowed options.` };
				}
				customFields[def.fieldKey] = rawText;
				break;
			}
		}
	}

	return {
		ok: true,
		value: {
			fullName,
			email: email || null,
			phone: phone || null,
			customFields
		}
	};
}
