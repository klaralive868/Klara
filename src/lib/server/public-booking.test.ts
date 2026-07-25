import { describe, expect, it } from 'vitest';
import { parseBookingForm } from './public-booking';

function formData(fields: Record<string, string>): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		data.set(key, value);
	}
	return data;
}

const VALID_FIELDS = {
	name: 'Jane Traveler',
	email: 'jane@example.com',
	phone: '555-0100',
	travelerCount: '2',
	notes: 'Aisle seats please.'
};

describe('parseBookingForm', () => {
	it('parses valid input', () => {
		const result = parseBookingForm(formData(VALID_FIELDS));
		expect(result).toEqual({
			ok: true,
			value: {
				name: 'Jane Traveler',
				email: 'jane@example.com',
				phone: '555-0100',
				travelerCount: 2,
				notes: 'Aisle seats please.'
			}
		});
	});

	it('treats a blank phone and notes as null', () => {
		const result = parseBookingForm(formData({ ...VALID_FIELDS, phone: ' ', notes: ' ' }));
		expect(result.ok && result.value.phone).toBeNull();
		expect(result.ok && result.value.notes).toBeNull();
	});

	it('rejects a blank name', () => {
		const result = parseBookingForm(formData({ ...VALID_FIELDS, name: '  ' }));
		expect(result).toEqual({ ok: false, message: 'Enter your name.' });
	});

	it('rejects a malformed email', () => {
		const result = parseBookingForm(formData({ ...VALID_FIELDS, email: 'not-an-email' }));
		expect(result).toEqual({ ok: false, message: 'Enter a valid email address.' });
	});

	it('rejects a non-numeric traveler count', () => {
		const result = parseBookingForm(formData({ ...VALID_FIELDS, travelerCount: 'two' }));
		expect(result).toEqual({ ok: false, message: 'Enter a valid traveler count.' });
	});

	it('rejects a zero traveler count', () => {
		const result = parseBookingForm(formData({ ...VALID_FIELDS, travelerCount: '0' }));
		expect(result).toEqual({ ok: false, message: 'Traveler count must be at least 1.' });
	});

	it('rejects a traveler count beyond a PostgreSQL integer column', () => {
		const result = parseBookingForm(formData({ ...VALID_FIELDS, travelerCount: '99999999999' }));
		expect(result).toEqual({ ok: false, message: 'Traveler count is too large.' });
	});
});
