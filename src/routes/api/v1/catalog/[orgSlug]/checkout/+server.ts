import {
	resolvePublicApiRequest,
	jsonOk,
	jsonError,
	parseJsonBody,
	createPreflightHandler
} from '$lib/server/public-api';
import { checkCheckoutRateLimit, checkout, parseCheckoutForm } from '$lib/server/public-checkout';
import type { RequestHandler } from './$types';

const RATE_LIMITED_ERROR = 'Too many requests. Please try again later.';

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

	const parsed = parseCheckoutForm(bodyResult.value);
	if (!parsed.ok) {
		return jsonError(400, parsed.message, { origin });
	}

	if (!checkCheckoutRateLimit(event.getClientAddress(), parsed.value.email)) {
		return jsonError(429, RATE_LIMITED_ERROR, { origin });
	}

	const outcome = await checkout(admin, organization.id, parsed.value);
	if (!outcome.ok) {
		return jsonError(outcome.status, outcome.message, { origin });
	}

	return jsonOk({ success: true, orderId: outcome.orderId }, { status: 201, origin });
};

export const OPTIONS: RequestHandler = createPreflightHandler('POST, OPTIONS');
