import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { findOrCreateCustomer, parseBookingForm } from './public-booking';

// A minimal stand-in for the single chain findOrCreateCustomer actually
// uses (from('customers').select/insert...) — queuing canned responses per
// call lets a test simulate the lookup-then-insert sequence, including the
// insert failing with a 23505 (unique-violation) partway through.
function fakeSupabase({
	selectResponses,
	insertResponse
}: {
	selectResponses: Array<{ data: { id: string } | null; error: unknown }>;
	insertResponse?: { data: { id: string } | null; error: unknown };
}): SupabaseClient {
	let selectCall = 0;
	return {
		from: () => ({
			select: () => ({
				eq: () => ({
					ilike: () => ({
						limit: () => ({
							maybeSingle: async () => selectResponses[selectCall++]
						})
					})
				})
			}),
			insert: () => ({
				select: () => ({
					single: async () => insertResponse
				})
			})
		})
	} as unknown as SupabaseClient;
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
		const result = parseBookingForm(VALID_FIELDS);
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
		const result = parseBookingForm({ ...VALID_FIELDS, phone: ' ', notes: ' ' });
		expect(result.ok && result.value.phone).toBeNull();
		expect(result.ok && result.value.notes).toBeNull();
	});

	it('rejects a blank name', () => {
		const result = parseBookingForm({ ...VALID_FIELDS, name: '  ' });
		expect(result).toEqual({ ok: false, message: 'Enter your name.' });
	});

	it('rejects a malformed email', () => {
		const result = parseBookingForm({ ...VALID_FIELDS, email: 'not-an-email' });
		expect(result).toEqual({ ok: false, message: 'Enter a valid email address.' });
	});

	it('rejects a non-numeric traveler count', () => {
		const result = parseBookingForm({ ...VALID_FIELDS, travelerCount: 'two' });
		expect(result).toEqual({ ok: false, message: 'Enter a valid traveler count.' });
	});

	it('rejects a zero traveler count', () => {
		const result = parseBookingForm({ ...VALID_FIELDS, travelerCount: '0' });
		expect(result).toEqual({ ok: false, message: 'Traveler count must be at least 1.' });
	});

	it('rejects a traveler count beyond a PostgreSQL integer column', () => {
		const result = parseBookingForm({ ...VALID_FIELDS, travelerCount: '99999999999' });
		expect(result).toEqual({ ok: false, message: 'Traveler count is too large.' });
	});

	// FormData can never produce anything but a string here, but the JSON API
	// endpoint's body can — a single-element array stringifies to its bare
	// element (`String(['jane@example.com'])` === `'jane@example.com'`),
	// which would otherwise sail straight through the email pattern check.
	it('rejects an array field value instead of coercing it with String()', () => {
		const result = parseBookingForm({ ...VALID_FIELDS, email: ['jane@example.com'] });
		expect(result).toEqual({ ok: false, message: 'Invalid field value.' });
	});

	it('rejects an object field value instead of persisting "[object Object]"', () => {
		const result = parseBookingForm({ ...VALID_FIELDS, notes: { evil: true } });
		expect(result).toEqual({ ok: false, message: 'Invalid field value.' });
	});
});

describe('findOrCreateCustomer', () => {
	it('returns an existing customer without inserting', async () => {
		const supabase = fakeSupabase({
			selectResponses: [{ data: { id: 'existing-id' }, error: null }]
		});

		const result = await findOrCreateCustomer(supabase, 'org-1', 'Jane', 'jane@example.com', null);
		expect(result).toEqual({ id: 'existing-id' });
	});

	it('creates a new customer when none exists', async () => {
		const supabase = fakeSupabase({
			selectResponses: [{ data: null, error: null }],
			insertResponse: { data: { id: 'new-id' }, error: null }
		});

		const result = await findOrCreateCustomer(supabase, 'org-1', 'Jane', 'jane@example.com', null);
		expect(result).toEqual({ id: 'new-id' });
	});

	// The race this covers: two concurrent first-time requests for the same
	// (organization_id, email) both pass the initial lookup before either
	// insert runs. The DB's case-insensitive unique index lets one insert
	// win and fails the other with 23505 — the loser should recover by
	// re-selecting the winner's row, not by erroring out or creating a
	// second customer.
	it('recovers a concurrent-insert conflict by re-selecting the winning row', async () => {
		const supabase = fakeSupabase({
			selectResponses: [
				{ data: null, error: null },
				{ data: { id: 'winner-id' }, error: null }
			],
			insertResponse: { data: null, error: { code: '23505', message: 'duplicate key value' } }
		});

		const result = await findOrCreateCustomer(supabase, 'org-1', 'Jane', 'jane@example.com', null);
		expect(result).toEqual({ id: 'winner-id' });
	});

	it('returns null when the insert fails for a reason other than a conflict', async () => {
		const supabase = fakeSupabase({
			selectResponses: [{ data: null, error: null }],
			insertResponse: { data: null, error: { code: '23503', message: 'foreign key violation' } }
		});

		const result = await findOrCreateCustomer(supabase, 'org-1', 'Jane', 'jane@example.com', null);
		expect(result).toBeNull();
	});

	// Shared by both the booking (#43) and inquiry (#47) public submission
	// flows — a newly-created customer must be labeled with whichever flow
	// actually created it, not always 'booking'.
	it('defaults a newly-created customer to source: booking', async () => {
		let insertedRow: Record<string, unknown> | undefined;
		const supabase = {
			from: () => ({
				select: () => ({
					eq: () => ({
						ilike: () => ({
							limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) })
						})
					})
				}),
				insert: (row: Record<string, unknown>) => {
					insertedRow = row;
					return {
						select: () => ({ single: async () => ({ data: { id: 'new-id' }, error: null }) })
					};
				}
			})
		} as unknown as SupabaseClient;

		await findOrCreateCustomer(supabase, 'org-1', 'Jane', 'jane@example.com', null);
		expect(insertedRow?.source).toBe('booking');
	});

	it('creates a newly-created customer with an explicit source', async () => {
		let insertedRow: Record<string, unknown> | undefined;
		const supabase = {
			from: () => ({
				select: () => ({
					eq: () => ({
						ilike: () => ({
							limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) })
						})
					})
				}),
				insert: (row: Record<string, unknown>) => {
					insertedRow = row;
					return {
						select: () => ({ single: async () => ({ data: { id: 'new-id' }, error: null }) })
					};
				}
			})
		} as unknown as SupabaseClient;

		await findOrCreateCustomer(supabase, 'org-1', 'Jane', 'jane@example.com', null, 'inquiry');
		expect(insertedRow?.source).toBe('inquiry');
	});
});
