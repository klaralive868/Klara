import { error, fail } from '@sveltejs/kit';
import { createSupabaseAdminClient } from '$lib/server/supabase-admin';
import { getOrganizationBySlug } from '$lib/server/public-organization';
import { findOrCreateCustomer } from '$lib/server/public-booking';
import { createInquiry, parseInquiryForm } from '$lib/server/public-inquiry';
import { checkRateLimit, rateLimitKey } from '$lib/server/rate-limit';
import type { Actions, PageServerLoad } from './$types';

const INQUIRY_RATE_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };
const RATE_LIMITED_ERROR = 'Too many requests. Please try again later.';
const GENERIC_ERROR = 'Something went wrong. Please try again.';

export const load: PageServerLoad = async ({ params }) => {
	const admin = createSupabaseAdminClient();
	const organization = await getOrganizationBySlug(admin, params.orgSlug);
	if (!organization) {
		error(404, 'Not found');
	}
};

export const actions: Actions = {
	default: async ({ request, params, getClientAddress }) => {
		const admin = createSupabaseAdminClient();
		const organization = await getOrganizationBySlug(admin, params.orgSlug);
		if (!organization) {
			return fail(404, { message: GENERIC_ERROR });
		}

		const formData = await request.formData();
		const parsed = parseInquiryForm(formData);
		if (!parsed.ok) {
			return fail(400, { message: parsed.message });
		}

		// Lowercased so casing variants of the same address share one bucket —
		// same reasoning as the booking flow's rate-limit key (#43 review).
		const key = rateLimitKey('inquiry', getClientAddress(), parsed.value.email.toLowerCase());
		if (!checkRateLimit(key, INQUIRY_RATE_LIMIT)) {
			return fail(429, { message: RATE_LIMITED_ERROR });
		}

		// Reuses the exact match-or-create-by-email logic built for booking
		// submissions (#43) — same identity rule, same DB-level race
		// protection, no need to re-derive either. source: 'inquiry' so a
		// customer created purely through this flow isn't mislabeled as
		// having come from a booking.
		const customer = await findOrCreateCustomer(
			admin,
			organization.id,
			parsed.value.name,
			parsed.value.email,
			parsed.value.phone,
			'inquiry'
		);
		if (!customer) {
			return fail(500, { message: GENERIC_ERROR });
		}

		const created = await createInquiry(admin, {
			customerId: customer.id,
			tripDescription: parsed.value.tripDescription,
			preferredDates: parsed.value.preferredDates,
			partySize: parsed.value.partySize,
			budget: parsed.value.budget,
			notes: parsed.value.notes
		});
		if (!created) {
			return fail(500, { message: GENERIC_ERROR });
		}

		return { success: true };
	}
};
