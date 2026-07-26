export { EMAIL_PATTERN as CUSTOMER_EMAIL_PATTERN } from '$lib/email';

export type CustomerSource = 'booking' | 'inquiry' | 'manual' | 'import';
export type CustomerStatus = 'active' | 'archived';

export interface Customer {
	id: string;
	fullName: string;
	email: string | null;
	phone: string | null;
	customFields: Record<string, unknown>;
	source: CustomerSource;
	status: CustomerStatus;
}

// Raw shape of a row as returned by Supabase (snake_case columns).
export interface CustomerRow {
	id: string;
	full_name: string;
	email: string | null;
	phone: string | null;
	custom_fields: Record<string, unknown>;
	source: CustomerSource;
	status: CustomerStatus;
}

export function customerFromRow(row: CustomerRow): Customer {
	return {
		id: row.id,
		fullName: row.full_name,
		email: row.email,
		phone: row.phone,
		customFields: row.custom_fields,
		source: row.source,
		status: row.status
	};
}

export type CustomerFieldType = 'text' | 'number' | 'date' | 'select';

export interface CustomerFieldDefinition {
	id: string;
	fieldKey: string;
	label: string;
	fieldType: CustomerFieldType;
	options: string[] | null;
	required: boolean;
	displayOrder: number;
}

// Raw shape of a row as returned by Supabase (snake_case columns).
export interface CustomerFieldDefinitionRow {
	id: string;
	field_key: string;
	label: string;
	field_type: CustomerFieldType;
	options: string[] | null;
	required: boolean;
	display_order: number;
}

export function customerFieldDefinitionFromRow(
	row: CustomerFieldDefinitionRow
): CustomerFieldDefinition {
	return {
		id: row.id,
		fieldKey: row.field_key,
		label: row.label,
		fieldType: row.field_type,
		options: row.options,
		required: row.required,
		displayOrder: row.display_order
	};
}
