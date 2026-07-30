import { describe, expect, it } from 'vitest';
import { parseInquiryForm } from './public-inquiry';

function omit<T extends Record<string, unknown>>(fields: T, key: keyof T): Record<string, unknown> {
	return Object.fromEntries(Object.entries(fields).filter(([k]) => k !== key));
}

const VALID_FIELDS = {
	name: 'Jane Traveler',
	email: 'jane@example.com',
	phone: '555-0100',
	tripDescription: 'A safari through Kenya and Tanzania.',
	preferredDates: 'June 2027',
	partySize: '4',
	budget: '$15,000',
	notes: 'First-time safari travelers.',
	adultCount: '2',
	childCount: '1',
	destination: 'Kenya',
	travelStyle: ['adventure', 'family'],
	includeFlights: true,
	datesFlexible: false
};

const VALID_VALUE = {
	name: 'Jane Traveler',
	email: 'jane@example.com',
	phone: '555-0100',
	tripDescription: 'A safari through Kenya and Tanzania.',
	preferredDates: 'June 2027',
	partySize: 4,
	budget: '$15,000',
	notes: 'First-time safari travelers.',
	adultCount: 2,
	childCount: 1,
	destination: 'Kenya',
	travelStyle: ['adventure', 'family'],
	includeFlights: true,
	datesFlexible: false
};

describe('parseInquiryForm', () => {
	it('parses valid input', () => {
		const result = parseInquiryForm(VALID_FIELDS);
		expect(result).toEqual({ ok: true, value: VALID_VALUE });
	});

	it('treats blank optional fields as null, and defaults child/flag fields', () => {
		const result = parseInquiryForm({
			...VALID_FIELDS,
			phone: ' ',
			preferredDates: ' ',
			partySize: '',
			budget: ' ',
			notes: ' ',
			childCount: '',
			destination: ' ',
			travelStyle: undefined,
			includeFlights: undefined,
			datesFlexible: undefined
		});
		expect(result).toEqual({
			ok: true,
			value: {
				...VALID_VALUE,
				phone: null,
				preferredDates: null,
				partySize: null,
				budget: null,
				notes: null,
				childCount: 0,
				destination: null,
				travelStyle: null,
				includeFlights: false,
				datesFlexible: false
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

	// Same reasoning as public-booking.test.ts: FormData can never produce
	// anything but a string here, but the JSON API endpoint's body can — a
	// single-element array would otherwise stringify to its bare element and
	// bypass validation entirely.
	it('rejects an array field value instead of coercing it with String()', () => {
		const result = parseInquiryForm({ ...VALID_FIELDS, email: ['jane@example.com'] });
		expect(result).toEqual({ ok: false, message: 'Invalid field value.' });
	});

	it('rejects an object field value instead of persisting "[object Object]"', () => {
		const result = parseInquiryForm({ ...VALID_FIELDS, notes: { evil: true } });
		expect(result).toEqual({ ok: false, message: 'Invalid field value.' });
	});

	describe('adultCount', () => {
		it('is required — missing entirely is rejected', () => {
			const result = parseInquiryForm(omit(VALID_FIELDS, 'adultCount'));
			expect(result).toEqual({ ok: false, message: 'Enter a valid adult count.' });
		});

		it('rejects a non-numeric adult count', () => {
			const result = parseInquiryForm({ ...VALID_FIELDS, adultCount: 'two' });
			expect(result).toEqual({ ok: false, message: 'Enter a valid adult count.' });
		});

		it('rejects zero adults', () => {
			const result = parseInquiryForm({ ...VALID_FIELDS, adultCount: '0' });
			expect(result).toEqual({ ok: false, message: 'Adult count must be at least 1.' });
		});

		it('accepts exactly 1', () => {
			const result = parseInquiryForm({ ...VALID_FIELDS, adultCount: '1' });
			expect(result.ok && result.value.adultCount).toBe(1);
		});

		it('rejects an adult count beyond a PostgreSQL integer column', () => {
			const result = parseInquiryForm({ ...VALID_FIELDS, adultCount: '99999999999' });
			expect(result).toEqual({ ok: false, message: 'Adult count is too large.' });
		});
	});

	describe('childCount', () => {
		it('defaults to 0 when omitted', () => {
			const result = parseInquiryForm(omit(VALID_FIELDS, 'childCount'));
			expect(result.ok && result.value.childCount).toBe(0);
		});

		it('accepts 0 explicitly', () => {
			const result = parseInquiryForm({ ...VALID_FIELDS, childCount: '0' });
			expect(result.ok && result.value.childCount).toBe(0);
		});

		it('rejects a non-numeric child count', () => {
			const result = parseInquiryForm({ ...VALID_FIELDS, childCount: 'one' });
			expect(result).toEqual({ ok: false, message: 'Enter a valid child count.' });
		});

		it('rejects a negative child count (non-digit string)', () => {
			const result = parseInquiryForm({ ...VALID_FIELDS, childCount: '-1' });
			expect(result).toEqual({ ok: false, message: 'Enter a valid child count.' });
		});

		it('rejects a child count beyond a PostgreSQL integer column', () => {
			const result = parseInquiryForm({ ...VALID_FIELDS, childCount: '99999999999' });
			expect(result).toEqual({ ok: false, message: 'Child count is too large.' });
		});
	});

	describe('travelStyle', () => {
		it('is null when omitted', () => {
			const result = parseInquiryForm(omit(VALID_FIELDS, 'travelStyle'));
			expect(result.ok && result.value.travelStyle).toBeNull();
		});

		it('normalizes an empty array to null', () => {
			const result = parseInquiryForm({ ...VALID_FIELDS, travelStyle: [] });
			expect(result.ok && result.value.travelStyle).toBeNull();
		});

		it('trims entries and drops empty ones', () => {
			const result = parseInquiryForm({ ...VALID_FIELDS, travelStyle: [' beach ', '', 'foodie'] });
			expect(result.ok && result.value.travelStyle).toEqual(['beach', 'foodie']);
		});

		it('rejects a bare string instead of an array', () => {
			const result = parseInquiryForm({ ...VALID_FIELDS, travelStyle: 'beach' });
			expect(result).toEqual({ ok: false, message: 'travelStyle must be a list of strings.' });
		});

		it('rejects an array containing a non-string element', () => {
			const result = parseInquiryForm({ ...VALID_FIELDS, travelStyle: ['beach', 42] });
			expect(result).toEqual({ ok: false, message: 'travelStyle must be a list of strings.' });
		});
	});

	describe('includeFlights / datesFlexible', () => {
		it('default to false when omitted', () => {
			const withoutFlags = omit(omit(VALID_FIELDS, 'includeFlights'), 'datesFlexible');
			const result = parseInquiryForm(withoutFlags);
			expect(result.ok && result.value.includeFlights).toBe(false);
			expect(result.ok && result.value.datesFlexible).toBe(false);
		});

		it('accepts real JSON booleans', () => {
			const result = parseInquiryForm({
				...VALID_FIELDS,
				includeFlights: true,
				datesFlexible: true
			});
			expect(result.ok && result.value.includeFlights).toBe(true);
			expect(result.ok && result.value.datesFlexible).toBe(true);
		});

		it('accepts the "true"/"false" string convention used by HTML form submissions', () => {
			const result = parseInquiryForm({
				...VALID_FIELDS,
				includeFlights: 'true',
				datesFlexible: 'false'
			});
			expect(result.ok && result.value.includeFlights).toBe(true);
			expect(result.ok && result.value.datesFlexible).toBe(false);
		});

		it('rejects an ambiguous value instead of guessing', () => {
			const result = parseInquiryForm({ ...VALID_FIELDS, includeFlights: 'yes' });
			expect(result).toEqual({ ok: false, message: 'includeFlights must be true or false.' });
		});

		it('rejects a number where a boolean is expected', () => {
			const result = parseInquiryForm({ ...VALID_FIELDS, datesFlexible: 1 });
			expect(result).toEqual({ ok: false, message: 'datesFlexible must be true or false.' });
		});
	});

	describe('destination', () => {
		it('is optional and trimmed', () => {
			const result = parseInquiryForm({ ...VALID_FIELDS, destination: '  Barbados  ' });
			expect(result.ok && result.value.destination).toBe('Barbados');
		});
	});
});
