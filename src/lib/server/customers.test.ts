import { describe, expect, it } from 'vitest';
import { parseCustomerForm } from './customers';
import type { FieldDefinition } from '$lib/field-definitions/types';

function formData(fields: Record<string, string>): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		data.set(key, value);
	}
	return data;
}

function fieldDef(overrides: Partial<FieldDefinition> = {}): FieldDefinition {
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

function coreDef(fieldKey: 'email' | 'phone', overrides: Partial<FieldDefinition> = {}): FieldDefinition {
	return fieldDef({
		fieldKey,
		label: fieldKey === 'email' ? 'Email' : 'Phone',
		isCore: true,
		...overrides
	});
}

describe('parseCustomerForm', () => {
	it('parses a valid full name with no field definitions', () => {
		const result = parseCustomerForm(formData({ fullName: 'Jane Doe' }), []);
		expect(result).toEqual({
			ok: true,
			value: { fullName: 'Jane Doe', coreValues: {}, customFields: {} }
		});
	});

	it('rejects a blank full name', () => {
		const result = parseCustomerForm(formData({ fullName: '   ' }), []);
		expect(result).toEqual({ ok: false, message: 'Enter a name for the customer.' });
	});

	it('rejects a missing full name even if a dynamic field is valid', () => {
		const def = fieldDef({ required: false });
		const result = parseCustomerForm(formData({ fullName: '', field_pet_name: 'Rex' }), [def]);
		expect(result).toEqual({ ok: false, message: 'Enter a name for the customer.' });
	});

	it('routes active email/phone core fields into coreValues, not customFields', () => {
		const result = parseCustomerForm(
			formData({ fullName: 'Jane Doe', field_email: 'jane@example.com', field_phone: '555-1234' }),
			[coreDef('email'), coreDef('phone')]
		);
		expect(result.ok && result.value.coreValues).toEqual({
			email: 'jane@example.com',
			phone: '555-1234'
		});
		expect(result.ok && result.value.customFields).toEqual({});
	});

	it('writes explicit nulls for blank active email/phone (clears, does not omit)', () => {
		const result = parseCustomerForm(formData({ fullName: 'Jane Doe' }), [
			coreDef('email'),
			coreDef('phone')
		]);
		expect(result.ok && result.value.coreValues).toEqual({ email: null, phone: null });
	});

	it('omits email/phone from coreValues entirely when inactive (not passed in)', () => {
		const result = parseCustomerForm(formData({ fullName: 'Jane Doe' }), []);
		expect(result.ok && result.value.coreValues).toEqual({});
	});

	it('rejects a missing required dynamic text field', () => {
		const def = fieldDef({ required: true });
		const result = parseCustomerForm(formData({ fullName: 'Jane Doe' }), [def]);
		expect(result).toEqual({ ok: false, message: 'Pet name is required.' });
	});

	it('omits an optional dynamic field left blank, rather than storing an empty string', () => {
		const def = fieldDef({ required: false });
		const result = parseCustomerForm(formData({ fullName: 'Jane Doe' }), [def]);
		expect(result.ok && result.value.customFields).toEqual({});
	});

	it('accepts a valid text field', () => {
		const def = fieldDef({ fieldType: 'text', required: true });
		const result = parseCustomerForm(
			formData({ fullName: 'Jane Doe', field_pet_name: 'Rex' }),
			[def]
		);
		expect(result.ok && result.value.customFields).toEqual({ pet_name: 'Rex' });
	});

	it('rejects a non-numeric value for a number field', () => {
		const def = fieldDef({ fieldKey: 'visit_count', label: 'Visit count', fieldType: 'number' });
		const result = parseCustomerForm(
			formData({ fullName: 'Jane Doe', field_visit_count: 'not-a-number' }),
			[def]
		);
		expect(result).toEqual({ ok: false, message: 'Visit count must be a number.' });
	});

	it('parses a valid number field to an actual number, not a string', () => {
		const def = fieldDef({ fieldKey: 'visit_count', label: 'Visit count', fieldType: 'number' });
		const result = parseCustomerForm(
			formData({ fullName: 'Jane Doe', field_visit_count: '3' }),
			[def]
		);
		expect(result.ok && result.value.customFields).toEqual({ visit_count: 3 });
	});

	it('rejects a malformed date', () => {
		const def = fieldDef({ fieldKey: 'birthday', label: 'Birthday', fieldType: 'date' });
		const result = parseCustomerForm(
			formData({ fullName: 'Jane Doe', field_birthday: '13/40/2026' }),
			[def]
		);
		expect(result).toEqual({ ok: false, message: 'Birthday must be a valid date.' });
	});

	it('accepts a valid ISO date', () => {
		const def = fieldDef({ fieldKey: 'birthday', label: 'Birthday', fieldType: 'date' });
		const result = parseCustomerForm(
			formData({ fullName: 'Jane Doe', field_birthday: '2020-01-15' }),
			[def]
		);
		expect(result.ok && result.value.customFields).toEqual({ birthday: '2020-01-15' });
	});

	it("rejects a select value not in the definition's options", () => {
		const def = fieldDef({
			fieldKey: 'preferred_groomer',
			label: 'Preferred groomer',
			fieldType: 'select',
			options: ['Alex', 'Sam']
		});
		const result = parseCustomerForm(
			formData({ fullName: 'Jane Doe', field_preferred_groomer: 'Someone Else' }),
			[def]
		);
		expect(result).toEqual({
			ok: false,
			message: 'Preferred groomer must be one of the allowed options.'
		});
	});

	it('accepts a select value that matches an option', () => {
		const def = fieldDef({
			fieldKey: 'preferred_groomer',
			label: 'Preferred groomer',
			fieldType: 'select',
			options: ['Alex', 'Sam']
		});
		const result = parseCustomerForm(
			formData({ fullName: 'Jane Doe', field_preferred_groomer: 'Sam' }),
			[def]
		);
		expect(result.ok && result.value.customFields).toEqual({ preferred_groomer: 'Sam' });
	});

	it('assembles multiple dynamic fields into one custom_fields object', () => {
		const defs = [
			fieldDef({ fieldKey: 'pet_name', label: 'Pet name', fieldType: 'text', required: true }),
			fieldDef({ fieldKey: 'visit_count', label: 'Visit count', fieldType: 'number' })
		];
		const result = parseCustomerForm(
			formData({ fullName: 'Jane Doe', field_pet_name: 'Rex', field_visit_count: '5' }),
			defs
		);
		expect(result.ok && result.value.customFields).toEqual({ pet_name: 'Rex', visit_count: 5 });
	});

	it('accepts a boolean field', () => {
		const def = fieldDef({ fieldKey: 'vip', label: 'VIP', fieldType: 'boolean' });
		const result = parseCustomerForm(formData({ fullName: 'Jane Doe', field_vip: 'true' }), [def]);
		expect(result.ok && result.value.customFields).toEqual({ vip: true });
	});

	it('accepts a multi_select field', () => {
		const def = fieldDef({
			fieldKey: 'interests',
			label: 'Interests',
			fieldType: 'multi_select',
			options: ['Running', 'Yoga']
		});
		const data = new FormData();
		data.set('fullName', 'Jane Doe');
		data.append('field_interests', 'Running');
		data.append('field_interests', 'Yoga');
		const result = parseCustomerForm(data, [def]);
		expect(result.ok && result.value.customFields).toEqual({ interests: ['Running', 'Yoga'] });
	});
});
