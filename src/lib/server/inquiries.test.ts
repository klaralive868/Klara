import { describe, expect, it } from 'vitest';
import { parseManualInquiryForm } from './inquiries';

function formData(fields: Record<string, string>): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		data.set(key, value);
	}
	return data;
}

const VALID_FIELDS = {
	customerId: 'customer-1',
	tripDescription: 'A week in the Alps.',
	preferredDates: 'September 2026',
	partySize: '2',
	budget: '$5,000',
	notes: 'Prefers boutique hotels.'
};

describe('parseManualInquiryForm', () => {
	it('parses valid input', () => {
		const result = parseManualInquiryForm(formData(VALID_FIELDS));
		expect(result).toEqual({
			ok: true,
			value: {
				customerId: 'customer-1',
				tripDescription: 'A week in the Alps.',
				preferredDates: 'September 2026',
				partySize: 2,
				budget: '$5,000',
				notes: 'Prefers boutique hotels.'
			}
		});
	});

	it('treats blank optional fields as null', () => {
		const result = parseManualInquiryForm(
			formData({ ...VALID_FIELDS, preferredDates: ' ', partySize: '', budget: ' ', notes: ' ' })
		);
		expect(result).toEqual({
			ok: true,
			value: {
				customerId: 'customer-1',
				tripDescription: 'A week in the Alps.',
				preferredDates: null,
				partySize: null,
				budget: null,
				notes: null
			}
		});
	});

	it('rejects a missing customer', () => {
		const result = parseManualInquiryForm(formData({ ...VALID_FIELDS, customerId: '' }));
		expect(result).toEqual({ ok: false, message: 'Select a customer.' });
	});

	it('rejects a blank trip description', () => {
		const result = parseManualInquiryForm(formData({ ...VALID_FIELDS, tripDescription: '  ' }));
		expect(result).toEqual({ ok: false, message: 'Enter a trip description.' });
	});

	it('rejects a non-numeric party size', () => {
		const result = parseManualInquiryForm(formData({ ...VALID_FIELDS, partySize: 'two' }));
		expect(result).toEqual({ ok: false, message: 'Enter a valid party size.' });
	});

	it('rejects a zero party size', () => {
		const result = parseManualInquiryForm(formData({ ...VALID_FIELDS, partySize: '0' }));
		expect(result).toEqual({ ok: false, message: 'Party size must be at least 1.' });
	});

	it('rejects a party size beyond a PostgreSQL integer column', () => {
		const result = parseManualInquiryForm(formData({ ...VALID_FIELDS, partySize: '99999999999' }));
		expect(result).toEqual({ ok: false, message: 'Party size is too large.' });
	});
});
