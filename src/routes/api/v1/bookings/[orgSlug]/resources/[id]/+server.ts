import {
	resolvePublicApiRequest,
	jsonOk,
	jsonError,
	createPreflightHandler
} from '$lib/server/public-api';
import { getPublishedResource } from '$lib/server/public-resources';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const result = await resolvePublicApiRequest(event);
	if (!result.ok) {
		return result.response;
	}
	const { organization, origin, admin } = result.context;

	// A draft/archived resource, or one belonging to a different
	// organization than the slug resolved to, is indistinguishable from a
	// nonexistent id here — same visibility rule as the page-action route
	// (Standards §5).
	const resource = await getPublishedResource(admin, organization.id, event.params.id ?? '');
	if (!resource) {
		return jsonError(404, 'Not found', { origin });
	}

	return jsonOk(resource, { origin });
};

export const OPTIONS: RequestHandler = createPreflightHandler('GET, OPTIONS');
