import { describe, expect, it } from 'vitest';
import { parseInquiryForm } from './public-inquiry';

const VALID_FIELDS = {
	name: 'Jane Traveler',
	email: 'jane@example.com',
	phone: '555-0100',
	tripDescription: 'A safari through Kenya and Tanzania.',
	preferredDates: 'June 2027',
	partySize: '4',
	budget: '$15,000',
	notes: 'First-time safari travelers.'
};

describe('parseInquiryForm', () => {
	it('parses valid input', () => {
		const result = parseInquiryForm(VALID_FIELDS);
		expect(result).toEqual({
			ok: true,
			value: {
				name: 'Jane Traveler',
				email: 'jane@example.com',
				phone: '555-0100',
				tripDescription: 'A safari through Kenya and Tanzania.',
				preferredDates: 'June 2027',
				partySize: 4,
				budget: '$15,000',
				notes: 'First-time safari travelers.'
			}
		});
	});

	it('treats blank optional fields as null', () => {
		const result = parseInquiryForm({
			...VALID_FIELDS,
			phone: ' ',
			preferredDates: ' ',
			partySize: '',
			budget: ' ',
			notes: ' '
		});
		expect(result).toEqual({
			ok: true,
			value: {
				name: 'Jane Traveler',
				email: 'jane@example.com',
				phone: null,
				tripDescription: 'A safari through Kenya and Tanzania.',
				preferredDates: null,
				partySize: null,
				budget: null,
				notes: null
			}
		});
	});

	it('rejects a blank name', () => {
		const result = parseInquiryForm({ ...VALID_FIELDS, name: '  ' });
		expect(result).toEqual({ ok: false, message: 'Enter your name.' });
	});

	it('rejects a malformed email', () => {
		const result = parseInquiryForm({ ...VALID_FIELDS, email: 'not-an-email' });
		expect(result).toEqual({ ok: false, message: 'Enter a valid email address.' });
	});

	it('rejects a blank trip description', () => {
		const result = parseInquiryForm({ ...VALID_FIELDS, tripDescription: '  ' });
		expect(result).toEqual({ ok: false, message: 'Tell us where you would like to go.' });
	});

	it('rejects a non-numeric party size', () => {
		const result = parseInquiryForm({ ...VALID_FIELDS, partySize: 'four' });
		expect(result).toEqual({ ok: false, message: 'Enter a valid party size.' });
	});

	it('rejects a zero party size', () => {
		const result = parseInquiryForm({ ...VALID_FIELDS, partySize: '0' });
		expect(result).toEqual({ ok: false, message: 'Party size must be at least 1.' });
	});

	it('rejects a party size beyond a PostgreSQL integer column', () => {
		const result = parseInquiryForm({ ...VALID_FIELDS, partySize: '99999999999' });
		expect(result).toEqual({ ok: false, message: 'Party size is too large.' });
	});
});
