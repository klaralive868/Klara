import { error, fail } from '@sveltejs/kit';
import { createSupabaseAdminClient } from '$lib/server/supabase-admin';
import { getOrganizationBySlug } from '$lib/server/public-organization';
import { getPublishedResource } from '$lib/server/public-resources';
import {
	createBooking,
	findOrCreateCustomer,
	parseBookingForm
} from '$lib/server/public-booking';
import { checkRateLimit, rateLimitKey } from '$lib/server/rate-limit';
import type { Actions, PageServerLoad } from './$types';

const BOOKING_RATE_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };
const RATE_LIMITED_ERROR = 'Too many requests. Please try again later.';
const GENERIC_ERROR = 'Something went wrong. Please try again.';

export const load: PageServerLoad = async ({ params }) => {
	const admin = createSupabaseAdminClient();
	const organization = await getOrganizationBySlug(admin, params.orgSlug);
	if (!organization) {
		error(404, 'Package not found');
	}

	// A draft/archived resource — or one belonging to a different
	// organization than the slug resolved to — 404s the same as a
	// nonexistent one; a visitor should never be able to tell the
	// difference (Standards §5's visibility-lifecycle intent).
	const resource = await getPublishedResource(admin, organization.id, params.id);
	if (!resource) {
		error(404, 'Package not found');
	}

	return { resource };
};

export const actions: Actions = {
	default: async ({ request, params, getClientAddress }) => {
		const admin = createSupabaseAdminClient();
		const organization = await getOrganizationBySlug(admin, params.orgSlug);
		if (!organization) {
			return fail(404, { message: GENERIC_ERROR });
		}

		const resource = await getPublishedResource(admin, organization.id, params.id);
		if (!resource) {
			return fail(404, { message: GENERIC_ERROR });
		}

		const formData = await request.formData();
		const parsed = parseBookingForm(formData);
		if (!parsed.ok) {
			return fail(400, { message: parsed.message });
		}

		const key = rateLimitKey('booking', getClientAddress(), parsed.value.email);
		if (!checkRateLimit(key, BOOKING_RATE_LIMIT)) {
			return fail(429, { message: RATE_LIMITED_ERROR });
		}

		const customer = await findOrCreateCustomer(
			admin,
			organization.id,
			parsed.value.name,
			parsed.value.email,
			parsed.value.phone
		);
		if (!customer) {
			return fail(500, { message: GENERIC_ERROR });
		}

		// start_at/end_at always come from the resource's own dates, never the
		// requester — a visitor can ask for a package, not choose its dates.
		const created = await createBooking(admin, {
			resourceId: resource.id,
			customerId: customer.id,
			travelerCount: parsed.value.travelerCount,
			notes: parsed.value.notes,
			startAt: resource.departureDate,
			endAt: resource.returnDate
		});
		if (!created) {
			return fail(500, { message: GENERIC_ERROR });
		}

		return { success: true };
	}
};
