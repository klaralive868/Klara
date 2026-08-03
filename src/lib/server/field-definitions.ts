import type { SupabaseClient } from '@supabase/supabase-js';
import {
	FIELD_DEFINITION_SELECT,
	fieldDefinitionFromRow,
	type CoreFieldState,
	type FieldDefinition,
	type FieldDefinitionRow,
	type FieldEntityType,
	type FieldsForManagement,
	type FieldType
} from '$lib/field-definitions/types';

// field_key is derived from the label, not typed separately — same
// "one thing to name, not two" reasoning as most self-serve add flows.
// Underscore-separated (matches every existing field_key in this codebase:
// preferred_size, loyalty_member_id, pet_name), not hyphenated like
// $lib/slug.ts's URL slugs — this is a jsonb-key/identifier, not a URL.
export function fieldKeyFromLabel(label: string): string {
	return label
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
}

const FIELD_TYPES: readonly FieldType[] = [
	'text',
	'number',
	'date',
	'select',
	'boolean',
	'multi_select'
];

function isFieldType(value: string): value is FieldType {
	return (FIELD_TYPES as readonly string[]).includes(value);
}

export interface ParsedAddFieldForm {
	label: string;
	fieldKey: string;
	fieldType: FieldType;
	options: string[] | null;
	required: boolean;
}

export type ParseAddFieldFormResult =
	| { ok: true; value: ParsedAddFieldForm }
	| { ok: false; message: string };

// Parses the "add a custom field" form — shared by every entity_type's
// manage-fields page (ADR-0011). Never used for is_core rows: those are
// provisioned by migration/operator action, not this self-serve add flow
// (Standards §2: a field_key claiming to be email/phone here is just an
// ordinary custom field with that name — is_core is never client-settable).
export function parseAddFieldForm(formData: FormData): ParseAddFieldFormResult {
	const label = String(formData.get('label') ?? '').trim();
	const fieldTypeRaw = String(formData.get('fieldType') ?? '');
	const required = formData.get('required') === 'true';

	if (!label) {
		return { ok: false, message: 'Enter a name for the field.' };
	}
	if (!isFieldType(fieldTypeRaw)) {
		return { ok: false, message: 'Choose a valid field type.' };
	}

	const fieldKey = fieldKeyFromLabel(label);
	if (!fieldKey) {
		return { ok: false, message: 'Enter a name using at least one letter or number.' };
	}

	let options: string[] | null = null;
	if (fieldTypeRaw === 'select' || fieldTypeRaw === 'multi_select') {
		const rawOptions = String(formData.get('options') ?? '')
			.split(',')
			.map((o) => o.trim())
			.filter(Boolean);
		if (rawOptions.length === 0) {
			return { ok: false, message: 'Enter at least one option, separated by commas.' };
		}
		options = rawOptions;
	}

	return { ok: true, value: { label, fieldKey, fieldType: fieldTypeRaw, options, required } };
}

// The known, whitelisted set of toggleable core fields per entity_type
// (Standards §2: whitelist, not blacklist) — mirrors the DB's own
// `field_definitions` check constraint exactly (customer: email/phone;
// order: none, since every existing Orders column is structurally
// intrinsic, not optional business data — see ADR-0011). A brand-new
// organization has zero field_definitions rows at all, so this is also
// what the manage-fields UI shows as "available to turn on" before any row
// exists for it yet.
export const CORE_FIELDS: Record<
	FieldEntityType,
	readonly { fieldKey: string; label: string; fieldType: FieldType }[]
> = {
	customer: [
		{ fieldKey: 'email', label: 'Email', fieldType: 'text' },
		{ fieldKey: 'phone', label: 'Phone', fieldType: 'text' }
	],
	order: []
};

export type FieldDefinitionActionResult = { ok: true } | { ok: false; message: string };

// Adds a new custom field for this organization/entity_type. organization_id
// defaults to the caller's own org (table default, same as every other
// org-scoped insert) — never accepted from the client.
export async function addCustomField(
	supabase: SupabaseClient,
	entityType: FieldEntityType,
	parsed: ParsedAddFieldForm
): Promise<FieldDefinitionActionResult> {
	const { error } = await supabase.from('field_definitions').insert({
		entity_type: entityType,
		field_key: parsed.fieldKey,
		label: parsed.label,
		field_type: parsed.fieldType,
		options: parsed.options,
		required: parsed.required,
		is_core: false
	});

	if (error) {
		if (error.code === '23505') {
			return { ok: false, message: 'A field with that name already exists.' };
		}
		return { ok: false, message: 'Could not add the field. Please try again.' };
	}

	return { ok: true };
}

// Toggles an existing CUSTOM field's visibility. Never touches
// custom_fields data, only this row's `active` flag — soft-hide, not
// delete (Standards §5).
//
// Scoped by entity_type AND is_core = false, not just id — RLS already
// confines the update to the caller's own organization, but within that
// org a same-organization field id could otherwise belong to the *other*
// entity_type (a customer field toggled through the orders page or vice
// versa) or be an is_core row (email/phone), silently bypassing
// setCoreFieldActive's dedicated whitelist. Both are real cross-purpose
// gaps, not cross-org ones — this closes both by making the id alone
// insufficient to match a row outside what this action is actually for.
export async function setFieldActive(
	supabase: SupabaseClient,
	entityType: FieldEntityType,
	fieldId: string,
	active: boolean
): Promise<FieldDefinitionActionResult> {
	const { data, error } = await supabase
		.from('field_definitions')
		.update({ active })
		.eq('id', fieldId)
		.eq('entity_type', entityType)
		.eq('is_core', false)
		.select('id');

	if (error) {
		return { ok: false, message: 'Could not update the field. Please try again.' };
	}
	if (!data || data.length === 0) {
		return { ok: false, message: 'Field not found.' };
	}

	return { ok: true };
}

// Toggles a core field's visibility. Unlike setFieldActive, this may need
// to create the definition row on first activation — a brand-new
// organization starts with zero field_definitions rows at all (ADR-0011:
// new orgs start minimal, no email/phone backfill), so "turn phone on" for
// such an org has no existing row to update. Upserts on the same
// (organization_id, entity_type, field_key) unique constraint the table
// already enforces; organization_id is never passed explicitly — the
// column default (current_organization_id()) supplies it on the insert
// path, exactly as every other org-scoped insert in this codebase relies
// on. Never touches customers.email/phone themselves, only this row.
export async function setCoreFieldActive(
	supabase: SupabaseClient,
	entityType: FieldEntityType,
	fieldKey: string,
	active: boolean
): Promise<FieldDefinitionActionResult> {
	const known = CORE_FIELDS[entityType].find((f) => f.fieldKey === fieldKey);
	if (!known) {
		return { ok: false, message: 'Unknown core field.' };
	}

	const { error } = await supabase.from('field_definitions').upsert(
		{
			entity_type: entityType,
			field_key: known.fieldKey,
			label: known.label,
			field_type: known.fieldType,
			is_core: true,
			active
		},
		{ onConflict: 'organization_id,entity_type,field_key' }
	);

	if (error) {
		return { ok: false, message: 'Could not update the field. Please try again.' };
	}

	return { ok: true };
}

// Loads only active definitions for an entity_type — the shape every
// create/edit form needs (Customers now, Orders next): passed straight into
// parseFieldValues/parseCustomerForm and the shared DynamicFieldGroup
// renderer. Deliberately excludes inactive rows, not just as a display
// filter — parseFieldValues relies on an inactive definition never being
// passed to it at all (see field-values.ts) to correctly distinguish
// "clear this value" from "leave this column/key untouched".
export async function loadActiveFieldDefinitions(
	supabase: SupabaseClient,
	entityType: FieldEntityType
): Promise<FieldDefinition[]> {
	const { data, error } = await supabase
		.from('field_definitions')
		.select(FIELD_DEFINITION_SELECT)
		.eq('entity_type', entityType)
		.eq('active', true)
		.order('display_order', { ascending: true });

	if (error) {
		throw new Error(`field-definitions: failed to load active definitions: ${error.message}`);
	}

	return (data as FieldDefinitionRow[]).map(fieldDefinitionFromRow);
}

// Shared loader for the manage-fields page (ADR-0011) — every entity_type
// uses this same shape. Core fields are merged from the code-owned
// CORE_FIELDS whitelist with whatever row (if any) exists for this org, so
// a brand-new org with zero field_definitions rows still shows "Email" and
// "Phone" as available-to-turn-on, not as if they don't exist.
export async function loadFieldsForManagement(
	supabase: SupabaseClient,
	entityType: FieldEntityType
): Promise<FieldsForManagement> {
	const { data, error } = await supabase
		.from('field_definitions')
		.select(FIELD_DEFINITION_SELECT)
		.eq('entity_type', entityType)
		.order('display_order', { ascending: true });

	if (error) {
		throw new Error(`field-definitions: failed to load for management: ${error.message}`);
	}

	const rows = (data as FieldDefinitionRow[]).map(fieldDefinitionFromRow);
	const coreRowsByKey = new Map(rows.filter((r) => r.isCore).map((r) => [r.fieldKey, r]));

	const coreFields: CoreFieldState[] = CORE_FIELDS[entityType].map((known) => {
		const existing = coreRowsByKey.get(known.fieldKey);
		return {
			fieldKey: known.fieldKey,
			label: known.label,
			fieldType: known.fieldType,
			active: existing?.active ?? false,
			definitionId: existing?.id ?? null
		};
	});

	const customRows = rows.filter((r) => !r.isCore);
	return {
		coreFields,
		activeCustomFields: customRows.filter((r) => r.active),
		inactiveCustomFields: customRows.filter((r) => !r.active)
	};
}
