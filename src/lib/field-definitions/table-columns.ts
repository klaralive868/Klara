import type { FieldDefinition } from './types';

// Reads a field's value off an entity row (Customer, Order, ...) that
// exposes a `customFields` jsonb bag — is_core fields live on a real,
// top-level column (e.g. row.email); genuinely custom fields live in
// customFields, keyed by field_key. Shared by every module's dynamic
// table columns (ADR-0011) so this routing logic exists exactly once.
export function fieldValue<T extends { customFields: Record<string, unknown> }>(
	row: T,
	def: FieldDefinition
): unknown {
	return def.isCore
		? (row as unknown as Record<string, unknown>)[def.fieldKey]
		: row.customFields[def.fieldKey];
}

export function formatFieldValue(value: unknown, def: FieldDefinition): string {
	if (value === null || value === undefined || value === '') return '';
	if (def.fieldType === 'boolean') return value ? 'Yes' : 'No';
	if (def.fieldType === 'multi_select') return Array.isArray(value) ? value.join(', ') : '';
	return String(value);
}

// multi_select has no natural sort order for a set of values (ADR-0011) —
// every other type sorts fine with TanStack's default comparator (ISO date
// strings sort correctly as plain strings; booleans coerce to 0/1).
export function isSortableFieldType(def: FieldDefinition): boolean {
	return def.fieldType !== 'multi_select';
}

export interface NumberRangeFilter {
	min: number | null;
	max: number | null;
}

export function numberRangeFilterFn(
	row: { getValue: (columnId: string) => unknown },
	columnId: string,
	filterValue: NumberRangeFilter
): boolean {
	if (filterValue.min === null && filterValue.max === null) return true;
	const raw = row.getValue(columnId);
	if (raw === null || raw === undefined || raw === '') return false;
	const value = Number(raw);
	if (filterValue.min !== null && value < filterValue.min) return false;
	if (filterValue.max !== null && value > filterValue.max) return false;
	return true;
}

export interface DateRangeFilter {
	from: string | null;
	to: string | null;
}

// ISO "YYYY-MM-DD" strings compare correctly with plain string comparison —
// no Date parsing needed.
export function dateRangeFilterFn(
	row: { getValue: (columnId: string) => unknown },
	columnId: string,
	filterValue: DateRangeFilter
): boolean {
	if (filterValue.from === null && filterValue.to === null) return true;
	const raw = row.getValue(columnId) as string | null | undefined;
	if (!raw) return false;
	if (filterValue.from !== null && raw < filterValue.from) return false;
	if (filterValue.to !== null && raw > filterValue.to) return false;
	return true;
}

export function facetFilterFn(
	row: { getValue: (columnId: string) => unknown },
	columnId: string,
	filterValue: Set<string>
): boolean {
	if (!filterValue || filterValue.size === 0) return true;
	return filterValue.has(String(row.getValue(columnId)));
}

export function multiSelectFacetFilterFn(
	row: { getValue: (columnId: string) => unknown },
	columnId: string,
	filterValue: Set<string>
): boolean {
	if (!filterValue || filterValue.size === 0) return true;
	const raw = row.getValue(columnId);
	if (!Array.isArray(raw)) return false;
	return raw.some((v) => filterValue.has(String(v)));
}

// A dynamic filter's ColumnFiltersState entry always exists once its
// definition is active (see DynamicFieldFilterControls), even when the
// user hasn't actually set a value — an empty Set / all-null range is a
// legitimate "no filter" default, not "the user filtered on nothing."
// Used to decide whether a Reset control should show, not for the actual
// filterFn logic (which already handles the empty/no-op case correctly on
// its own).
export function isDynamicFilterValueActive(value: unknown): boolean {
	if (value instanceof Set) return value.size > 0;
	if (typeof value === 'string') return value.trim() !== '';
	if (value && typeof value === 'object') {
		return Object.values(value as Record<string, unknown>).some(
			(v) => v !== null && v !== undefined && v !== ''
		);
	}
	return false;
}

export const BOOLEAN_FACET_OPTIONS = [
	{ value: 'true', label: 'Yes' },
	{ value: 'false', label: 'No' }
];
