import {
	resolvePublicApiRequest,
	jsonOk,
	jsonError,
	createPreflightHandler
} from '$lib/server/public-api';
import { getPublishedCatalogItem } from '$lib/server/public-catalog';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const result = await resolvePublicApiRequest(event);
	if (!result.ok) {
		return result.response;
	}
	const { organization, origin, admin } = result.context;

	// A draft/archived item, or one belonging to a different organization
	// than the slug resolved to, is indistinguishable from a nonexistent
	// id here — same visibility rule as the Bookings equivalent (Standards §5).
	const item = await getPublishedCatalogItem(admin, organization.id, event.params.id ?? '');
	if (!item) {
		return jsonError(404, 'Not found', { origin });
	}

	return jsonOk(item, { origin });
};

export const OPTIONS: RequestHandler = createPreflightHandler('GET, OPTIONS');
