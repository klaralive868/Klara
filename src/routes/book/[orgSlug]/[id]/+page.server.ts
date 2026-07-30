import { error, fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '$lib/server/supabase-admin';
import { getOrganizationBySlug } from '$lib/server/public-organization';
import { getPublishedResource, type PublicResource } from '$lib/server/public-resources';
import {
	checkBookingRateLimit,
	createBooking,
	findOrCreateCustomer,
	parseBookingForm
} from '$lib/server/public-booking';
import type { Actions, PageServerLoad } from './$types';

const RATE_LIMITED_ERROR = 'Too many requests. Please try again later.';
const GENERIC_ERROR = 'Something went wrong. Please try again.';

// A draft/archived resource — or one belonging to a different organization
// than the slug resolved to — resolves to null the same as a nonexistent
// one; a visitor should never be able to tell the difference (Standards §5's
// visibility-lifecycle intent). Shared by both the load and the action so
// the org-then-resource resolution isn't duplicated between them.
async function resolvePublishedResource(
	admin: SupabaseClient,
	orgSlug: string,
	resourceId: string
): Promise<{ organizationId: string; resource: PublicResource } | null> {
	const organization = await getOrganizationBySlug(admin, orgSlug);
	if (!organization) {
		return null;
	}

	const resource = await getPublishedResource(admin, organization.id, resourceId);
	if (!resource) {
		return null;
	}

	return { organizationId: organization.id, resource };
}

export const load: PageServerLoad = async ({ params }) => {
	const admin = createSupabaseAdminClient();
	const resolved = await resolvePublishedResource(admin, params.orgSlug, params.id);
	if (!resolved) {
		error(404, 'Package not found');
	}

	return { resource: resolved.resource };
};

export const actions: Actions = {
	default: async ({ request, params, getClientAddress }) => {
		const admin = createSupabaseAdminClient();
		const resolved = await resolvePublishedResource(admin, params.orgSlug, params.id);
		if (!resolved) {
			return fail(404, { message: GENERIC_ERROR });
		}
		const { organizationId, resource } = resolved;

		const formData = await request.formData();
		const parsed = parseBookingForm(Object.fromEntries(formData));
		if (!parsed.ok) {
			return fail(400, { message: parsed.message });
		}

		if (!checkBookingRateLimit(getClientAddress(), parsed.value.email)) {
			return fail(429, { message: RATE_LIMITED_ERROR });
		}

		const customer = await findOrCreateCustomer(
			admin,
			organizationId,
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
