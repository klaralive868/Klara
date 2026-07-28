import {
	resolvePublicApiRequest,
	jsonOk,
	jsonError,
	parseJsonBody,
	createPreflightHandler
} from '$lib/server/public-api';
import { findOrCreateCustomer } from '$lib/server/public-booking';
import {
	checkInquiryRateLimit,
	createInquiry,
	parseInquiryForm
} from '$lib/server/public-inquiry';
import type { RequestHandler } from './$types';

const RATE_LIMITED_ERROR = 'Too many requests. Please try again later.';
const GENERIC_ERROR = 'Something went wrong. Please try again.';

// Mirrors src/routes/book/[orgSlug]/inquiry/+page.server.ts's `default`
// action — same shared functions, JSON in/out instead of a form POST
// (ADR-0008: no duplicated business logic between the two entry points).
export const POST: RequestHandler = async (event) => {
	const result = await resolvePublicApiRequest(event);
	if (!result.ok) {
		return result.response;
	}
	const { organization, origin, admin } = result.context;

	const bodyResult = await parseJsonBody(event, origin);
	if (!bodyResult.ok) {
		return bodyResult.response;
	}

	const parsed = parseInquiryForm(bodyResult.value);
	if (!parsed.ok) {
		return jsonError(400, parsed.message, { origin });
	}

	if (!checkInquiryRateLimit(event.getClientAddress(), parsed.value.email)) {
		return jsonError(429, RATE_LIMITED_ERROR, { origin });
	}

	// Reuses the exact match-or-create-by-email logic the booking flow
	// uses, source: 'inquiry' so a customer created purely through this
	// flow isn't mislabeled as having come from a booking.
	const customer = await findOrCreateCustomer(
		admin,
		organization.id,
		parsed.value.name,
		parsed.value.email,
		parsed.value.phone,
		'inquiry'
	);
	if (!customer) {
		return jsonError(500, GENERIC_ERROR, { origin });
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
		return jsonError(500, GENERIC_ERROR, { origin });
	}

	return jsonOk({ success: true }, { status: 201, origin });
};

export const OPTIONS: RequestHandler = createPreflightHandler('POST, OPTIONS');
