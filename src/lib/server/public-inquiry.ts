import type { SupabaseClient } from '@supabase/supabase-js';
import { EMAIL_PATTERN } from '$lib/email';
import { PG_INTEGER_MAX } from '$lib/server/pg';

export interface ParsedInquiryForm {
	name: string;
	email: string;
	phone: string | null;
	tripDescription: string;
	preferredDates: string | null;
	partySize: number | null;
	budget: string | null;
	notes: string | null;
}

export type ParseInquiryFormResult =
	| { ok: true; value: ParsedInquiryForm }
	| { ok: false; message: string };

export function parseInquiryForm(formData: FormData): ParseInquiryFormResult {
	const name = String(formData.get('name') ?? '').trim();
	const email = String(formData.get('email') ?? '').trim();
	const phone = String(formData.get('phone') ?? '').trim();
	const tripDescription = String(formData.get('tripDescription') ?? '').trim();
	const preferredDates = String(formData.get('preferredDates') ?? '').trim();
	const partySizeRaw = String(formData.get('partySize') ?? '').trim();
	const budget = String(formData.get('budget') ?? '').trim();
	const notes = String(formData.get('notes') ?? '').trim();

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
			notes: notes || null
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
		status: 'new'
	});

	return !error;
}
