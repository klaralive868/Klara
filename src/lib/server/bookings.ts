import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BookingStatus, SeatCounts } from '$lib/bookings/types';

// Capacity is purely informational (Bookings #44 spec — never gates a
// booking action), but an agent still needs to see how a resource's seat
// limit is tracking: confirmed bookings' traveler counts consumed against
// it, plus pending ones requesting more. Cancelled/completed bookings don't
// count toward either — completed already happened (doesn't "consume" a
// still-open capacity in any forward-looking sense) and cancelled never did.
export async function getResourceSeatCounts(
	supabase: SupabaseClient,
	resourceId: string
): Promise<SeatCounts> {
	const { data, error } = await supabase
		.from('bookings')
		.select('status, traveler_count')
		.eq('resource_id', resourceId)
		.in('status', ['pending', 'confirmed']);

	if (error || !data) {
		return { confirmed: 0, pending: 0 };
	}

	const counts: SeatCounts = { confirmed: 0, pending: 0 };
	for (const row of data as { status: string; traveler_count: number }[]) {
		if (row.status === 'confirmed') {
			counts.confirmed += row.traveler_count;
		} else if (row.status === 'pending') {
			counts.pending += row.traveler_count;
		}
	}
	return counts;
}

// Shared shape behind confirm/cancel/complete: an update guarded by a status
// precondition (never a capacity one — capacity is purely informational,
// Bookings #44 spec), reporting "not found" the same way for a wrong id, a
// different organization's booking (RLS-filtered), or one already past the
// required starting status — there's no way to distinguish those from the
// caller's side, and there shouldn't be.
export async function transitionBookingStatus(
	supabase: SupabaseClient,
	bookingId: string,
	options: {
		to: BookingStatus;
		fromAnyOf: BookingStatus[];
		genericErrorMessage: string;
		notFoundMessage: string;
		successMessage: string;
	}
) {
	const { data, error: updateError } = await supabase
		.from('bookings')
		.update({ status: options.to })
		.eq('id', bookingId)
		.in('status', options.fromAnyOf)
		.select('id')
		.maybeSingle();

	if (updateError) {
		return fail(500, { message: options.genericErrorMessage });
	}
	if (!data) {
		return fail(404, { message: options.notFoundMessage });
	}

	return { success: true, message: options.successMessage };
}

export interface ParsedManualBookingForm {
	customerId: string;
	resourceId: string;
	travelerCount: number;
	notes: string | null;
}

export type ParseManualBookingFormResult =
	| { ok: true; value: ParsedManualBookingForm }
	| { ok: false; message: string };

// bookings.traveler_count is a PostgreSQL `integer` column — same bound
// fixed for resources' price/quantity (Bookings #38) and the public
// booking form's traveler count (Bookings #43).
const PG_INTEGER_MAX = 2147483647;

export function parseManualBookingForm(formData: FormData): ParseManualBookingFormResult {
	const customerId = String(formData.get('customerId') ?? '').trim();
	const resourceId = String(formData.get('resourceId') ?? '').trim();
	const travelerCountRaw = String(formData.get('travelerCount') ?? '').trim();
	const notes = String(formData.get('notes') ?? '').trim();

	if (!customerId) {
		return { ok: false, message: 'Select a customer.' };
	}
	if (!resourceId) {
		return { ok: false, message: 'Select a package.' };
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
		value: { customerId, resourceId, travelerCount, notes: notes || null }
	};
}
