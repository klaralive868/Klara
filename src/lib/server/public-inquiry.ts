import type { SupabaseClient } from '@supabase/supabase-js';
import { EMAIL_PATTERN } from '$lib/email';
import { PG_INTEGER_MAX } from '$lib/server/pg';
import { checkRateLimit, rateLimitKey } from '$lib/server/rate-limit';

const INQUIRY_RATE_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };
// The per-email bucket alone is bypassable: the email is attacker-controlled
// input, not an authenticated identity, so rotating it manufactures a fresh
// allowance on every submission. This IP-only bucket (a higher ceiling, to
// tolerate several genuine visitors behind one shared/NAT'd IP) caps total
// writes regardless of how many emails one requester cycles through.
const INQUIRY_IP_RATE_LIMIT = { limit: 20, windowMs: 15 * 60 * 1000 };

// Shared by both the page action and the API endpoint (ADR-0008 / Standards
// §12) — checks the IP-only bucket first, then the IP+email bucket, same
// order and same reasoning as the original page-action implementation.
export function checkInquiryRateLimit(ip: string, email: string): boolean {
	const ipKey = rateLimitKey('inquiry-ip', ip, '');
	if (!checkRateLimit(ipKey, INQUIRY_IP_RATE_LIMIT)) {
		return false;
	}

	const key = rateLimitKey('inquiry', ip, email.toLowerCase());
	return checkRateLimit(key, INQUIRY_RATE_LIMIT);
}

export interface ParsedInquiryForm {
	name: string;
	email: string;
	phone: string | null;
	tripDescription: string;
	preferredDates: string | null;
	partySize: number | null;
	budget: string | null;
	notes: string | null;
	adultCount: number;
	childCount: number;
	destination: string | null;
	travelStyle: string[] | null;
	includeFlights: boolean;
	datesFlexible: boolean;
}

export type ParseInquiryFormResult =
	{ ok: true; value: ParsedInquiryForm } | { ok: false; message: string };

// Same reasoning as public-booking.ts's toFieldString: form submissions can
// only ever produce a string here, but the JSON API endpoint's body can
// contain arbitrary JSON — an array or object value must be rejected rather
// than silently stringified (a single-element array bypasses e.g. the email
// pattern check, and a plain object would otherwise be persisted as the
// useless literal "[object Object]").
function toFieldString(value: unknown): string | null {
	if (value === null || value === undefined) {
		return '';
	}
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}
	return null;
}

// This function is shared by an HTML form POST and a JSON API body
// (ADR-0008), and the two represent booleans differently: the JSON API can
// send a real boolean, while a form submission is always a string — the
// exact "true"/"false" hidden-input convention already used elsewhere in
// this app (see resources.ts's hasCapacity/requiresManualConfirmation).
// Both are accepted; anything else (a number, "yes", "1") is rejected
// rather than guessed at.
function toFieldBoolean(value: unknown): boolean | null {
	if (value === null || value === undefined) {
		return false;
	}
	if (typeof value === 'boolean') {
		return value;
	}
	if (value === 'true') {
		return true;
	}
	if (value === 'false') {
		return false;
	}
	return null;
}

// A list of strings, or absent — anything else (a bare string, a number, an
// object, an array containing a non-string) is rejected outright rather than
// coerced. Trimmed and emptied-out entries dropped; an entirely-empty result
// (e.g. `[]` or `[""]`) normalizes to null, same as every other optional
// field's "nothing given" representation.
function toFieldStringArray(value: unknown): string[] | null | undefined {
	if (value === null || value === undefined) {
		return null;
	}
	if (!Array.isArray(value)) {
		return undefined;
	}
	const result: string[] = [];
	for (const entry of value) {
		if (typeof entry !== 'string') {
			return undefined;
		}
		const trimmed = entry.trim();
		if (trimmed) {
			result.push(trimmed);
		}
	}
	return result.length > 0 ? result : null;
}

// Takes a plain record rather than FormData — same reasoning as
// parseBookingForm: one validation implementation shared by the page action
// and the JSON API endpoint (ADR-0008).
export function parseInquiryForm(fields: Record<string, unknown>): ParseInquiryFormResult {
	const nameField = toFieldString(fields.name);
	const emailField = toFieldString(fields.email);
	const phoneField = toFieldString(fields.phone);
	const tripDescriptionField = toFieldString(fields.tripDescription);
	const preferredDatesField = toFieldString(fields.preferredDates);
	const partySizeField = toFieldString(fields.partySize);
	const budgetField = toFieldString(fields.budget);
	const notesField = toFieldString(fields.notes);
	const adultCountField = toFieldString(fields.adultCount);
	const childCountField = toFieldString(fields.childCount);
	const destinationField = toFieldString(fields.destination);

	if (
		nameField === null ||
		emailField === null ||
		phoneField === null ||
		tripDescriptionField === null ||
		preferredDatesField === null ||
		partySizeField === null ||
		budgetField === null ||
		notesField === null ||
		adultCountField === null ||
		childCountField === null ||
		destinationField === null
	) {
		return { ok: false, message: 'Invalid field value.' };
	}

	const travelStyleField = toFieldStringArray(fields.travelStyle);
	if (travelStyleField === undefined) {
		return { ok: false, message: 'travelStyle must be a list of strings.' };
	}

	const includeFlights = toFieldBoolean(fields.includeFlights);
	if (includeFlights === null) {
		return { ok: false, message: 'includeFlights must be true or false.' };
	}

	const datesFlexible = toFieldBoolean(fields.datesFlexible);
	if (datesFlexible === null) {
		return { ok: false, message: 'datesFlexible must be true or false.' };
	}

	const name = nameField.trim();
	const email = emailField.trim();
	const phone = phoneField.trim();
	const tripDescription = tripDescriptionField.trim();
	const preferredDates = preferredDatesField.trim();
	const partySizeRaw = partySizeField.trim();
	const budget = budgetField.trim();
	const notes = notesField.trim();
	const adultCountRaw = adultCountField.trim();
	const childCountRaw = childCountField.trim();
	const destination = destinationField.trim();

	if (!name) {
		return { ok: false, message: 'Enter your name.' };
	}
	if (!EMAIL_PATTERN.test(email)) {
		return { ok: false, message: 'Enter a valid email address.' };
	}
	if (!tripDescription) {
		return { ok: false, message: 'Tell us where you would like to go.' };
	}

	// Party size is optional — a visitor can describe a trip before knowing
	// exactly how many travelers, unlike a booking's traveler count (always
	// required, it's committing seats against a real resource).
	let partySize: number | null = null;
	if (partySizeRaw) {
		if (!/^\d+$/.test(partySizeRaw)) {
			return { ok: false, message: 'Enter a valid party size.' };
		}
		partySize = Number(partySizeRaw);
		if (partySize <= 0) {
			return { ok: false, message: 'Party size must be at least 1.' };
		}
		if (partySize > PG_INTEGER_MAX) {
			return { ok: false, message: 'Party size is too large.' };
		}
	}

	// Unlike party size, adult count is required — the Curated form always
	// asks "how many adults," even before a destination is settled.
	if (!/^\d+$/.test(adultCountRaw)) {
		return { ok: false, message: 'Enter a valid adult count.' };
	}
	const adultCount = Number(adultCountRaw);
	if (adultCount < 1) {
		return { ok: false, message: 'Adult count must be at least 1.' };
	}
	if (adultCount > PG_INTEGER_MAX) {
		return { ok: false, message: 'Adult count is too large.' };
	}

	// Child count is optional — absent/blank defaults to 0, same "nothing
	// given" shape as the other optional fields, not an error.
	let childCount = 0;
	if (childCountRaw) {
		if (!/^\d+$/.test(childCountRaw)) {
			return { ok: false, message: 'Enter a valid child count.' };
		}
		childCount = Number(childCountRaw);
		if (childCount > PG_INTEGER_MAX) {
			return { ok: false, message: 'Child count is too large.' };
		}
	}

	return {
		ok: true,
		value: {
			name,
			email,
			phone: phone || null,
			tripDescription,
			preferredDates: preferredDates || null,
			partySize,
			budget: budget || null,
			notes: notes || null,
			adultCount,
			childCount,
			destination: destination || null,
			travelStyle: travelStyleField,
			includeFlights,
			datesFlexible
		}
	};
}

export interface CreateInquiryParams {
	customerId: string;
	tripDescription: string;
	preferredDates: string | null;
	partySize: number | null;
	budget: string | null;
	notes: string | null;
	adultCount: number;
	childCount: number;
	destination: string | null;
	travelStyle: string[] | null;
	includeFlights: boolean;
	datesFlexible: boolean;
}

// Always created 'new' — matches the table default and the same "a public
// submission is a request, not a decision" rule the booking flow (#43)
// applies; only an agent moves it forward from here (#48).
export async function createInquiry(
	supabase: SupabaseClient,
	params: CreateInquiryParams
): Promise<boolean> {
	const { error } = await supabase.from('travel_inquiries').insert({
		customer_id: params.customerId,
		trip_description: params.tripDescription,
		preferred_dates: params.preferredDates,
		party_size: params.partySize,
		budget: params.budget,
		notes: params.notes,
		status: 'new',
		adult_count: params.adultCount,
		child_count: params.childCount,
		destination: params.destination,
		travel_style: params.travelStyle,
		include_flights: params.includeFlights,
		dates_flexible: params.datesFlexible
	});

	return !error;
}
