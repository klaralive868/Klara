import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';

// Shared by bookings (confirm/cancel/complete) and travel inquiries
// (start progress/convert/close): an update guarded by a status
// precondition, reporting "not found" the same way for a wrong id, a
// different organization's row (RLS-filtered), or one already past the
// required starting status — there's no way to distinguish those from the
// caller's side, and there shouldn't be.
export async function transitionStatus<Status extends string>(
	supabase: SupabaseClient,
	table: string,
	id: string,
	options: {
		to: Status;
		fromAnyOf: Status[];
		genericErrorMessage: string;
		notFoundMessage: string;
		successMessage: string;
	}
) {
	const { data, error: updateError } = await supabase
		.from(table)
		.update({ status: options.to })
		.eq('id', id)
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
