import { parseFieldValues } from './field-values';
import type { FieldDefinition } from '$lib/field-definitions/types';

export interface ParsedCustomerForm {
	fullName: string;
	// Only ever contains a key for a definition that is_core AND is active
	// (was passed in) — see parseFieldValues' ParsedFieldValues for why an
	// absent key must never be written to its column (preserves data when a
	// core field like email/phone is toggled off).
	coreValues: Record<string, unknown>;
	customFields: Record<string, unknown>;
}

export type ParseCustomerFormResult =
	| { ok: true; value: ParsedCustomerForm }
	| { ok: false; message: string };

// Validates the core `fullName` field (the one thing every customer record
// requires unconditionally — never a Field Definition, see ADR-0011) plus
// every field described by `fieldDefinitions`: is_core rows (e.g. email,
// phone — routed into `coreValues`, written to their real column by the
// caller) and genuine custom fields (routed into `customFields`, merged
// into the `custom_fields` jsonb column by the caller). `fieldDefinitions`
// must already be filtered to `active: true` and this organization's
// `entity_type: 'customer'` rows — always re-fetched server-side, never
// trusted from the client, so a tampered submission can't skip a required
// field or smuggle in a value of the wrong shape for its type.
export function parseCustomerForm(
	formData: FormData,
	fieldDefinitions: readonly FieldDefinition[]
): ParseCustomerFormResult {
	const fullName = String(formData.get('fullName') ?? '').trim();
	if (!fullName) {
		return { ok: false, message: 'Enter a name for the customer.' };
	}

	const parsedFields = parseFieldValues(formData, fieldDefinitions);
	if (!parsedFields.ok) {
		return parsedFields;
	}

	return {
		ok: true,
		value: {
			fullName,
			coreValues: parsedFields.value.coreValues,
			customFields: parsedFields.value.customFields
		}
	};
}
