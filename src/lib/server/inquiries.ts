import { PG_INTEGER_MAX } from '$lib/server/pg';

export interface ParsedManualInquiryForm {
	customerId: string;
	tripDescription: string;
	preferredDates: string | null;
	partySize: number | null;
	budget: string | null;
	notes: string | null;
}

export type ParseManualInquiryFormResult =
	| { ok: true; value: ParsedManualInquiryForm }
	| { ok: false; message: string };

export function parseManualInquiryForm(formData: FormData): ParseManualInquiryFormResult {
	const customerId = String(formData.get('customerId') ?? '').trim();
	const tripDescription = String(formData.get('tripDescription') ?? '').trim();
	const preferredDates = String(formData.get('preferredDates') ?? '').trim();
	const partySizeRaw = String(formData.get('partySize') ?? '').trim();
	const budget = String(formData.get('budget') ?? '').trim();
	const notes = String(formData.get('notes') ?? '').trim();

	if (!customerId) {
		return { ok: false, message: 'Select a customer.' };
	}
	if (!tripDescription) {
		return { ok: false, message: 'Enter a trip description.' };
	}

	// Party size is optional — an inquiry can be logged before the traveler
	// count is known, unlike a booking's traveler_count (always required,
	// it's already committing seats against a real resource).
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
			customerId,
			tripDescription,
			preferredDates: preferredDates || null,
			partySize,
			budget: budget || null,
			notes: notes || null
		}
	};
}
