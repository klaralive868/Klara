import {
	resolvePublicApiRequest,
	jsonOk,
	jsonError,
	parseJsonBody,
	createPreflightHandler
} from '$lib/server/public-api';
import { getPublishedResource } from '$lib/server/public-resources';
import {
	checkBookingRateLimit,
	createBooking,
	findOrCreateCustomer,
	parseBookingForm
} from '$lib/server/public-booking';
import type { RequestHandler } from './$types';

const RATE_LIMITED_ERROR = 'Too many requests. Please try again later.';
const GENERIC_ERROR = 'Something went wrong. Please try again.';

// Mirrors src/routes/book/[orgSlug]/[id]/+page.server.ts's `default` action
// — same operation, same shared functions, JSON in/out instead of a form
// POST/SvelteKit form-action response (ADR-0008: no duplicated business
// logic between the two entry points).
export const POST: RequestHandler = async (event) => {
	const result = await resolvePublicApiRequest(event);
	if (!result.ok) {
		return result.response;
	}
	const { organization, origin, admin } = result.context;

	const resource = await getPublishedResource(admin, organization.id, event.params.id ?? '');
	if (!resource) {
		return jsonError(404, GENERIC_ERROR, { origin });
	}

	const bodyResult = await parseJsonBody(event, origin);
	if (!bodyResult.ok) {
		return bodyResult.response;
	}

	const parsed = parseBookingForm(bodyResult.value);
	if (!parsed.ok) {
		return jsonError(400, parsed.message, { origin });
	}

	if (!checkBookingRateLimit(event.getClientAddress(), parsed.value.email)) {
		return jsonError(429, RATE_LIMITED_ERROR, { origin });
	}

	const customer = await findOrCreateCustomer(
		admin,
		organization.id,
		parsed.value.name,
		parsed.value.email,
		parsed.value.phone
	);
	if (!customer) {
		return jsonError(500, GENERIC_ERROR, { origin });
	}

	// start_at/end_at always come from the resource's own dates, never the
	// requester — an external caller can ask for a package, not choose its
	// dates, same rule as the page action.
	const created = await createBooking(admin, {
		resourceId: resource.id,
		customerId: customer.id,
		travelerCount: parsed.value.travelerCount,
		notes: parsed.value.notes,
		startAt: resource.departureDate,
		endAt: resource.returnDate
	});
	if (!created) {
		return jsonError(500, GENERIC_ERROR, { origin });
	}

	return jsonOk({ success: true }, { status: 201, origin });
};

export const OPTIONS: RequestHandler = createPreflightHandler('POST, OPTIONS');
