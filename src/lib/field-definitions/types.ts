// Generic field_definitions system (ADR-0011) — replaces the Customers-only
// CustomerFieldDefinition. entity_type discriminates which module a row
// belongs to; is_core distinguishes a visibility toggle over a real,
// already-existing typed column (e.g. customers.email) from a genuine
// custom field whose values live in that entity's `custom_fields` jsonb.

export type FieldEntityType = 'customer' | 'order';

export type FieldType = 'text' | 'number' | 'date' | 'select' | 'boolean' | 'multi_select';

export interface FieldDefinition {
	id: string;
	entityType: FieldEntityType;
	fieldKey: string;
	label: string;
	fieldType: FieldType;
	options: string[] | null;
	required: boolean;
	displayOrder: number;
	active: boolean;
	isCore: boolean;
}

// Raw shape of a row as returned by Supabase (snake_case columns).
export interface FieldDefinitionRow {
	id: string;
	entity_type: FieldEntityType;
	field_key: string;
	label: string;
	field_type: FieldType;
	options: string[] | null;
	required: boolean;
	display_order: number;
	active: boolean;
	is_core: boolean;
}

export const FIELD_DEFINITION_SELECT =
	'id, entity_type, field_key, label, field_type, options, required, display_order, active, is_core';

export function fieldDefinitionFromRow(row: FieldDefinitionRow): FieldDefinition {
	return {
		id: row.id,
		entityType: row.entity_type,
		fieldKey: row.field_key,
		label: row.label,
		fieldType: row.field_type,
		options: row.options,
		required: row.required,
		displayOrder: row.display_order,
		active: row.active,
		isCore: row.is_core
	};
}

// Every dynamic field's <input>/<select>/<checkbox> is named field_{fieldKey}
// — a neutral prefix, not "custom_", since a definition may be is_core (its
// value routes to a real column server-side) or genuinely custom (routes
// into custom_fields jsonb) — the input name itself carries no meaning
// about storage destination. Shared between the client-side form renderer
// and the server-side parser (field-values.ts) so the two can never drift.
export function fieldInputName(fieldKey: string): string {
	return `field_${fieldKey}`;
}

export interface CoreFieldState {
	fieldKey: string;
	label: string;
	fieldType: FieldType;
	active: boolean;
	definitionId: string | null;
}

export interface FieldsForManagement {
	coreFields: CoreFieldState[];
	activeCustomFields: FieldDefinition[];
	inactiveCustomFields: FieldDefinition[];
}

// Sizeless "sort core fields before custom fields" ordering, matching the
// migration's use of negative display_order for the email/phone backfill —
// any list of definitions fetched together should already come back sorted
// by display_order from the query; this is only for lists assembled from
// multiple sources.
export function sortByDisplayOrder(defs: readonly FieldDefinition[]): FieldDefinition[] {
	return [...defs].sort((a, b) => a.displayOrder - b.displayOrder);
}
