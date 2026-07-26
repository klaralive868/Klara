import type { SupabaseClient } from '@supabase/supabase-js';
import { EMAIL_PATTERN } from '$lib/email';
import { PG_INTEGER_MAX } from '$lib/server/pg';

export interface ParsedBookingForm {
	name: string;
	email: string;
	phone: string | null;
	travelerCount: number;
	notes: string | null;
}

export type ParseBookingFormResult =
	| { ok: true; value: ParsedBookingForm }
	| { ok: false; message: string };

export function parseBookingForm(formData: FormData): ParseBookingFormResult {
	const name = String(formData.get('name') ?? '').trim();
	const email = String(formData.get('email') ?? '').trim();
	const phone = String(formData.get('phone') ?? '').trim();
	const travelerCountRaw = String(formData.get('travelerCount') ?? '').trim();
	const notes = String(formData.get('notes') ?? '').trim();

	if (!name) {
		return { ok: false, message: 'Enter your name.' };
	}

	if (!EMAIL_PATTERN.test(email)) {
		return { ok: false, message: 'Enter a valid email address.' };
	}

	if (!/^\d+$/.test(travelerCountRaw)) {
		return { ok: false, message: 'Enter a valid traveler count.' };
	}
	const travelerCount = Number(travelerCountRaw);
	if (travelerCount <= 0) {
		return { ok: false, message: 'Traveler count must be at least 1.' };
	}
	if (travelerCount > PG_INTEGER_MAX) {
		return { ok: false, message: 'Traveler count is too large.' };
	}

	return {
		ok: true,
		value: {
			name,
			email,
			phone: phone || null,
			travelerCount,
			notes: notes || null
		}
	};
}

// ILIKE without wildcards is a case-insensitive equality match, but `%`/`_`
// in the input are still live wildcard characters to it — and `_` is common
// in real email local-parts (e.g. "user_name@example.com"), so an
// unescaped ILIKE would let one visitor's submission match a different,
// merely similarly-shaped, email. Escaping the three special characters
// (backslash first, so it doesn't double-escape the ones it just inserted)
// makes this a genuine exact match, just case-insensitive.
function escapeForIlike(value: string): string {
	return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export interface MatchedCustomer {
	id: string;
}

async function findCustomerByEmail(
	supabase: SupabaseClient,
	organizationId: string,
	email: string
): Promise<MatchedCustomer | null> {
	const { data, error } = await supabase
		.from('customers')
		.select('id')
		.eq('organization_id', organizationId)
		.ilike('email', escapeForIlike(email))
		.limit(1)
		.maybeSingle();

	return error ? null : data;
}

const UNIQUE_VIOLATION = '23505';

// Matches by (organization_id, email) case-insensitively, reusing an
// existing customer without overwriting their stored name/phone — a repeat
// visitor's second booking shouldn't silently clobber whatever the business
// already has on file for them. Creates one with source: 'booking' only
// when no match exists.
//
// The lookup-then-insert below still has a race window between two
// concurrent first-time requests for the same email — closed at the DB
// layer by customers_organization_id_email_lower_key (a case-insensitive
// unique index), not here. When both requests reach the insert, one wins
// and the other gets a 23505 unique-violation instead of a duplicate row;
// re-selecting on that error picks up the winner's row rather than
// treating the loser as a failure.
export async function findOrCreateCustomer(
	supabase: SupabaseClient,
	organizationId: string,
	fullName: string,
	email: string,
	phone: string | null
): Promise<MatchedCustomer | null> {
	const existing = await findCustomerByEmail(supabase, organizationId, email);
	if (existing) {
		return existing;
	}

	const { data: created, error: createError } = await supabase
		.from('customers')
		.insert({
			organization_id: organizationId,
			full_name: fullName,
			email,
			phone,
			source: 'booking'
		})
		.select('id')
		.single();

	if (!createError && created) {
		return created;
	}

	if (createError?.code === UNIQUE_VIOLATION) {
		return findCustomerByEmail(supabase, organizationId, email);
	}

	return null;
}

export interface CreateBookingParams {
	resourceId: string;
	customerId: string;
	travelerCount: number;
	notes: string | null;
	startAt: string;
	endAt: string;
}

// Always created 'pending' — a public submission is a request, never a
// confirmed booking; only an agent can move it forward (ticket #44).
export async function createBooking(
	supabase: SupabaseClient,
	params: CreateBookingParams
): Promise<boolean> {
	const { error } = await supabase.from('bookings').insert({
		resource_id: params.resourceId,
		customer_id: params.customerId,
		traveler_count: params.travelerCount,
		notes: params.notes,
		start_at: params.startAt,
		end_at: params.endAt,
		status: 'pending'
	});

	return !error;
}
