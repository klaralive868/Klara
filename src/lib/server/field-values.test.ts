import { describe, expect, it } from 'vitest';
import { parseFieldValues } from './field-values';
import type { FieldDefinition } from '$lib/field-definitions/types';

function formData(fields: Record<string, string | string[]>): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		if (Array.isArray(value)) {
			for (const v of value) data.append(key, v);
		} else {
			data.set(key, value);
		}
	}
	return data;
}

function def(overrides: Partial<FieldDefinition> = {}): FieldDefinition {
	return {
		id: 'def-1',
		entityType: 'customer',
		fieldKey: 'pet_name',
		label: 'Pet name',
		fieldType: 'text',
		options: null,
		required: false,
		displayOrder: 0,
		active: true,
		isCore: false,
		...overrides
	};
}

describe('parseFieldValues', () => {
	it('returns empty coreValues/customFields for no definitions', () => {
		const result = parseFieldValues(formData({}), []);
		expect(result).toEqual({ ok: true, value: { coreValues: {}, customFields: {} } });
	});

	it('routes a custom field into customFields', () => {
		const result = parseFieldValues(formData({ field_pet_name: 'Rex' }), [def()]);
		expect(result.ok && result.value.customFields).toEqual({ pet_name: 'Rex' });
		expect(result.ok && result.value.coreValues).toEqual({});
	});

	it('routes an is_core field into coreValues, not customFields', () => {
		const d = def({ fieldKey: 'phone', label: 'Phone', isCore: true });
		const result = parseFieldValues(formData({ field_phone: '555-1234' }), [d]);
		expect(result.ok && result.value.coreValues).toEqual({ phone: '555-1234' });
		expect(result.ok && result.value.customFields).toEqual({});
	});

	it('omits a blank optional custom field entirely (clears via absence)', () => {
		const result = parseFieldValues(formData({}), [def({ required: false })]);
		expect(result.ok && result.value.customFields).toEqual({});
	});

	it('writes an explicit null for a blank optional core field (clears via null)', () => {
		const d = def({ fieldKey: 'phone', isCore: true, required: false });
		const result = parseFieldValues(formData({}), [d]);
		expect(result.ok && result.value.coreValues).toEqual({ phone: null });
	});

	it('rejects a missing required field, custom or core', () => {
		const custom = parseFieldValues(formData({}), [def({ required: true })]);
		expect(custom).toEqual({ ok: false, message: 'Pet name is required.' });

		const core = parseFieldValues(formData({}), [
			def({ fieldKey: 'phone', label: 'Phone', isCore: true, required: true })
		]);
		expect(core).toEqual({ ok: false, message: 'Phone is required.' });
	});

	it('rejects a non-numeric value for a number field', () => {
		const d = def({ fieldKey: 'visit_count', label: 'Visit count', fieldType: 'number' });
		const result = parseFieldValues(formData({ field_visit_count: 'not-a-number' }), [d]);
		expect(result).toEqual({ ok: false, message: 'Visit count must be a number.' });
	});

	it('parses a valid number field to an actual number', () => {
		const d = def({ fieldKey: 'visit_count', label: 'Visit count', fieldType: 'number' });
		const result = parseFieldValues(formData({ field_visit_count: '3' }), [d]);
		expect(result.ok && result.value.customFields).toEqual({ visit_count: 3 });
	});

	it('rejects a malformed date', () => {
		const d = def({ fieldKey: 'birthday', label: 'Birthday', fieldType: 'date' });
		const result = parseFieldValues(formData({ field_birthday: '13/40/2026' }), [d]);
		expect(result).toEqual({ ok: false, message: 'Birthday must be a valid date.' });
	});

	it('accepts a valid ISO date', () => {
		const d = def({ fieldKey: 'birthday', label: 'Birthday', fieldType: 'date' });
		const result = parseFieldValues(formData({ field_birthday: '2020-01-15' }), [d]);
		expect(result.ok && result.value.customFields).toEqual({ birthday: '2020-01-15' });
	});

	it('rejects a select value not in options', () => {
		const d = def({ fieldKey: 'groomer', label: 'Groomer', fieldType: 'select', options: ['Alex', 'Sam'] });
		const result = parseFieldValues(formData({ field_groomer: 'Someone Else' }), [d]);
		expect(result).toEqual({ ok: false, message: 'Groomer must be one of the allowed options.' });
	});

	it('accepts a select value that matches an option', () => {
		const d = def({ fieldKey: 'groomer', label: 'Groomer', fieldType: 'select', options: ['Alex', 'Sam'] });
		const result = parseFieldValues(formData({ field_groomer: 'Sam' }), [d]);
		expect(result.ok && result.value.customFields).toEqual({ groomer: 'Sam' });
	});

	it('parses a checked boolean field as true', () => {
		const d = def({ fieldKey: 'vip', label: 'VIP', fieldType: 'boolean' });
		const result = parseFieldValues(formData({ field_vip: 'true' }), [d]);
		expect(result.ok && result.value.customFields).toEqual({ vip: true });
	});

	it('parses a missing boolean field as false, never as a required-field error', () => {
		const d = def({ fieldKey: 'vip', label: 'VIP', fieldType: 'boolean', required: true });
		const result = parseFieldValues(formData({}), [d]);
		expect(result.ok && result.value.customFields).toEqual({ vip: false });
	});

	it('rejects a multi_select value not in options', () => {
		const d = def({
			fieldKey: 'interests',
			label: 'Interests',
			fieldType: 'multi_select',
			options: ['Running', 'Yoga']
		});
		const result = parseFieldValues(formData({ field_interests: ['Running', 'Chess'] }), [d]);
		expect(result).toEqual({ ok: false, message: 'Interests must be one of the allowed options.' });
	});

	it('accepts multiple valid multi_select values', () => {
		const d = def({
			fieldKey: 'interests',
			label: 'Interests',
			fieldType: 'multi_select',
			options: ['Running', 'Yoga']
		});
		const result = parseFieldValues(formData({ field_interests: ['Running', 'Yoga'] }), [d]);
		expect(result.ok && result.value.customFields).toEqual({ interests: ['Running', 'Yoga'] });
	});

	it('rejects an empty required multi_select', () => {
		const d = def({ fieldKey: 'interests', label: 'Interests', fieldType: 'multi_select', options: ['A'], required: true });
		const result = parseFieldValues(formData({}), [d]);
		expect(result).toEqual({ ok: false, message: 'Interests is required.' });
	});

	it('stores an explicit empty array for a blank optional multi_select on an active definition', () => {
		const d = def({ fieldKey: 'interests', label: 'Interests', fieldType: 'multi_select', options: ['A'] });
		const result = parseFieldValues(formData({}), [d]);
		expect(result.ok && result.value.customFields).toEqual({ interests: [] });
	});

	it('assembles multiple fields, core and custom, in one pass', () => {
		const defs = [
			def({ fieldKey: 'phone', label: 'Phone', isCore: true }),
			def({ fieldKey: 'pet_name', label: 'Pet name', required: true }),
			def({ fieldKey: 'visit_count', label: 'Visit count', fieldType: 'number' })
		];
		const result = parseFieldValues(
			formData({ field_phone: '555-0000', field_pet_name: 'Rex', field_visit_count: '5' }),
			defs
		);
		expect(result.ok && result.value.coreValues).toEqual({ phone: '555-0000' });
		expect(result.ok && result.value.customFields).toEqual({ pet_name: 'Rex', visit_count: 5 });
	});
});
