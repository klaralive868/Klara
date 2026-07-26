import { describe, expect, it } from 'vitest';
import { parseManualBookingForm } from './bookings';

function formData(fields: Record<string, string>): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		data.set(key, value);
	}
	return data;
}

const VALID_FIELDS = {
	customerId: 'customer-1',
	resourceId: 'resource-1',
	travelerCount: '2',
	notes: 'Aisle seats please.'
};

describe('parseManualBookingForm', () => {
	it('parses valid input', () => {
		const result = parseManualBookingForm(formData(VALID_FIELDS));
		expect(result).toEqual({
			ok: true,
			value: {
				customerId: 'customer-1',
				resourceId: 'resource-1',
				travelerCount: 2,
				notes: 'Aisle seats please.'
			}
		});
	});

	it('treats blank notes as null', () => {
		const result = parseManualBookingForm(formData({ ...VALID_FIELDS, notes: ' ' }));
		expect(result.ok && result.value.notes).toBeNull();
	});

	it('rejects a missing customer', () => {
		const result = parseManualBookingForm(formData({ ...VALID_FIELDS, customerId: '' }));
		expect(result).toEqual({ ok: false, message: 'Select a customer.' });
	});

	it('rejects a missing resource', () => {
		const result = parseManualBookingForm(formData({ ...VALID_FIELDS, resourceId: '' }));
		expect(result).toEqual({ ok: false, message: 'Select a package.' });
	});

	it('rejects a non-numeric traveler count', () => {
		const result = parseManualBookingForm(formData({ ...VALID_FIELDS, travelerCount: 'two' }));
		expect(result).toEqual({ ok: false, message: 'Enter a valid traveler count.' });
	});

	it('rejects a zero traveler count', () => {
		const result = parseManualBookingForm(formData({ ...VALID_FIELDS, travelerCount: '0' }));
		expect(result).toEqual({ ok: false, message: 'Traveler count must be at least 1.' });
	});

	it('rejects a traveler count beyond a PostgreSQL integer column', () => {
		const result = parseManualBookingForm(formData({ ...VALID_FIELDS, travelerCount: '99999999999' }));
		expect(result).toEqual({ ok: false, message: 'Traveler count is too large.' });
	});
});
