import { describe, expect, it } from 'vitest';
import { parseResourceForm } from './resources';

function formData(fields: Record<string, string>): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		data.set(key, value);
	}
	return data;
}

const VALID_FIELDS = {
	name: 'Bali 7-Day Tour — Aug 12',
	description: 'A week in Bali.',
	departureDate: '2026-08-12',
	returnDate: '2026-08-19',
	price: '1999.99',
	requiresManualConfirmation: 'true',
	hasCapacity: 'false',
	quantity: ''
};

describe('parseResourceForm', () => {
	it('parses valid input, converting dollars to integer cents', () => {
		const result = parseResourceForm(formData(VALID_FIELDS));
		expect(result).toEqual({
			ok: true,
			value: {
				name: 'Bali 7-Day Tour — Aug 12',
				description: 'A week in Bali.',
				departureDate: '2026-08-12',
				returnDate: '2026-08-19',
				priceCents: 199999,
				quantity: null,
				requiresManualConfirmation: true,
				category: null,
				region: null,
				highlights: null
			}
		});
	});

	it('treats a blank description as null', () => {
		const result = parseResourceForm(formData({ ...VALID_FIELDS, description: '  ' }));
		expect(result.ok && result.value.description).toBeNull();
	});

	it('rejects a blank name', () => {
		const result = parseResourceForm(formData({ ...VALID_FIELDS, name: '  ' }));
		expect(result).toEqual({ ok: false, message: 'Enter a name for the resource.' });
	});

	it('rejects a malformed departure date', () => {
		const result = parseResourceForm(formData({ ...VALID_FIELDS, departureDate: '08/12/2026' }));
		expect(result).toEqual({ ok: false, message: 'Enter a valid departure date.' });
	});

	it('rejects a malformed return date', () => {
		const result = parseResourceForm(formData({ ...VALID_FIELDS, returnDate: 'not-a-date' }));
		expect(result).toEqual({ ok: false, message: 'Enter a valid return date.' });
	});

	it('rejects a return date before the departure date', () => {
		const result = parseResourceForm(
			formData({ ...VALID_FIELDS, departureDate: '2026-08-12', returnDate: '2026-08-01' })
		);
		expect(result).toEqual({
			ok: false,
			message: 'Return date must be on or after the departure date.'
		});
	});

	it('accepts a return date equal to the departure date (a single-day trip)', () => {
		const result = parseResourceForm(
			formData({ ...VALID_FIELDS, departureDate: '2026-08-12', returnDate: '2026-08-12' })
		);
		expect(result.ok).toBe(true);
	});

	it('rejects a negative price', () => {
		const result = parseResourceForm(formData({ ...VALID_FIELDS, price: '-10' }));
		expect(result).toEqual({ ok: false, message: 'Enter a valid price.' });
	});

	it('rejects a non-numeric price', () => {
		const result = parseResourceForm(formData({ ...VALID_FIELDS, price: 'abc' }));
		expect(result).toEqual({ ok: false, message: 'Enter a valid price.' });
	});

	it('leaves quantity null when hasCapacity is false, regardless of the quantity field', () => {
		const result = parseResourceForm(
			formData({ ...VALID_FIELDS, hasCapacity: 'false', quantity: '20' })
		);
		expect(result.ok && result.value.quantity).toBeNull();
	});

	it('parses a positive integer quantity when hasCapacity is true', () => {
		const result = parseResourceForm(
			formData({ ...VALID_FIELDS, hasCapacity: 'true', quantity: '20' })
		);
		expect(result.ok && result.value.quantity).toBe(20);
	});

	it('rejects a zero quantity when hasCapacity is true', () => {
		const result = parseResourceForm(
			formData({ ...VALID_FIELDS, hasCapacity: 'true', quantity: '0' })
		);
		expect(result).toEqual({ ok: false, message: 'Seat limit must be greater than zero.' });
	});

	it('rejects a negative quantity when hasCapacity is true', () => {
		const result = parseResourceForm(
			formData({ ...VALID_FIELDS, hasCapacity: 'true', quantity: '-5' })
		);
		expect(result).toEqual({ ok: false, message: 'Enter a valid seat limit.' });
	});

	it('rejects a non-integer quantity when hasCapacity is true', () => {
		const result = parseResourceForm(
			formData({ ...VALID_FIELDS, hasCapacity: 'true', quantity: '2.5' })
		);
		expect(result).toEqual({ ok: false, message: 'Enter a valid seat limit.' });
	});

	it('rejects a blank quantity when hasCapacity is true', () => {
		const result = parseResourceForm(
			formData({ ...VALID_FIELDS, hasCapacity: 'true', quantity: '' })
		);
		expect(result).toEqual({ ok: false, message: 'Enter a valid seat limit.' });
	});

	it('defaults requiresManualConfirmation to false when the field is absent', () => {
		const data = formData(VALID_FIELDS);
		data.delete('requiresManualConfirmation');
		const result = parseResourceForm(data);
		expect(result.ok && result.value.requiresManualConfirmation).toBe(false);
	});

	it('treats blank category and region as null', () => {
		const result = parseResourceForm(formData({ ...VALID_FIELDS, category: '  ', region: '  ' }));
		expect(result.ok && result.value.category).toBeNull();
		expect(result.ok && result.value.region).toBeNull();
	});

	it('trims category and region', () => {
		const result = parseResourceForm(
			formData({ ...VALID_FIELDS, category: ' Adventure ', region: ' Southeast Asia ' })
		);
		expect(result.ok && result.value.category).toBe('Adventure');
		expect(result.ok && result.value.region).toBe('Southeast Asia');
	});

	it('is null when no highlights are given', () => {
		const result = parseResourceForm(formData(VALID_FIELDS));
		expect(result.ok && result.value.highlights).toBeNull();
	});

	it('collects multiple highlights entries sharing one field name, trimmed', () => {
		const data = formData(VALID_FIELDS);
		data.append('highlights', ' All-inclusive ');
		data.append('highlights', 'Private pool');
		data.append('highlights', '   ');
		const result = parseResourceForm(data);
		expect(result.ok && result.value.highlights).toEqual(['All-inclusive', 'Private pool']);
	});
});
