import { fieldInputName, type FieldDefinition } from '$lib/field-definitions/types';

export interface ParsedFieldValues {
	// Only ever contains a key for a definition that is_core AND was passed
	// in (i.e. active) — callers must only assign a payload column for keys
	// present here, and leave any absent core column untouched on update.
	// This is what makes toggling a core field off preserve its existing
	// data: an inactive core field is never passed to this function, so it
	// can never appear here, so no caller ever includes it in a write.
	coreValues: Record<string, unknown>;
	// Every non-core definition's parsed value, keyed by field_key — meant
	// to be merged into custom_fields the same way parseCustomerForm's
	// caller already does (only replacing keys belonging to a definition
	// that was actually passed in, preserving everything else untouched).
	customFields: Record<string, unknown>;
}

export type ParseFieldValuesResult =
	| { ok: true; value: ParsedFieldValues }
	| { ok: false; message: string };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Validates and parses every field in `definitions` (caller-supplied,
// always re-fetched server-side and always pre-filtered to `active: true`
// — an inactive definition must never reach this function, since its
// presence/absence here is exactly what distinguishes "clear this value"
// from "leave this column/key untouched", see ParsedFieldValues above).
// Shared by every entity type (Customers, Orders, ...) — the one seam every
// module's form-parsing logic reuses (ADR-0011).
export function parseFieldValues(
	formData: FormData,
	definitions: readonly FieldDefinition[]
): ParseFieldValuesResult {
	const coreValues: Record<string, unknown> = {};
	const customFields: Record<string, unknown> = {};

	for (const def of definitions) {
		const destination = def.isCore ? coreValues : customFields;
		const name = fieldInputName(def.fieldKey);

		if (def.fieldType === 'boolean') {
			// Checkbox convention used elsewhere in this codebase (e.g. Catalog's
			// unlimitedStock): a hidden input always submits "true"/"false", so
			// presence alone is meaningless — the value decides. Never "blank":
			// false is a real, valid value, not an omission.
			destination[def.fieldKey] = String(formData.get(name) ?? 'false') === 'true';
			continue;
		}

		if (def.fieldType === 'multi_select') {
			const raw = formData.getAll(name).map(String);
			for (const value of raw) {
				if (!def.options || !def.options.includes(value)) {
					return { ok: false, message: `${def.label} must be one of the allowed options.` };
				}
			}
			if (raw.length === 0) {
				if (def.required) {
					return { ok: false, message: `${def.label} is required.` };
				}
				// Active + blank means "clear this value" (matches every other
				// type's blank-and-not-required handling below) — explicit empty
				// array, not omitted, since is_core multi_select doesn't exist
				// (DB-constrained) and a custom field's caller expects a real
				// value here to overwrite whatever was previously stored.
				destination[def.fieldKey] = [];
				continue;
			}
			destination[def.fieldKey] = raw;
			continue;
		}

		const raw = formData.get(name);
		const rawText = raw === null ? '' : String(raw).trim();

		if (!rawText) {
			if (def.required) {
				return { ok: false, message: `${def.label} is required.` };
			}
			// Active + blank: for an is_core field this must still clear the
			// real column (explicit null), so the key IS set here — unlike a
			// definition that's absent entirely (inactive), which must never
			// appear in coreValues at all. For a custom field, the caller's
			// existing merge logic relies on the key being *absent* here to
			// mean "clear" (see parseCustomerForm) — so only is_core writes
			// an explicit null; a non-core field is genuinely omitted.
			if (def.isCore) {
				destination[def.fieldKey] = null;
			}
			continue;
		}

		switch (def.fieldType) {
			case 'text':
				destination[def.fieldKey] = rawText;
				break;

			case 'number': {
				const parsed = Number(rawText);
				if (!Number.isFinite(parsed)) {
					return { ok: false, message: `${def.label} must be a number.` };
				}
				destination[def.fieldKey] = parsed;
				break;
			}

			case 'date': {
				// <input type="date"> submits YYYY-MM-DD — reject anything else
				// rather than passing it through to a Date constructor, which
				// silently accepts a wide range of ambiguous formats.
				if (!DATE_PATTERN.test(rawText) || Number.isNaN(Date.parse(rawText))) {
					return { ok: false, message: `${def.label} must be a valid date.` };
				}
				destination[def.fieldKey] = rawText;
				break;
			}

			case 'select': {
				if (!def.options || !def.options.includes(rawText)) {
					return { ok: false, message: `${def.label} must be one of the allowed options.` };
				}
				destination[def.fieldKey] = rawText;
				break;
			}
		}
	}

	return { ok: true, value: { coreValues, customFields } };
}
