import { resolvePublicApiRequest, jsonOk, createPreflightHandler } from '$lib/server/public-api';
import { listPublishedCatalogItems } from '$lib/server/public-catalog';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const result = await resolvePublicApiRequest(event);
	if (!result.ok) {
		return result.response;
	}
	const { organization, origin, admin } = result.context;

	const items = await listPublishedCatalogItems(admin, organization.id);
	return jsonOk(items, { origin });
};

export const OPTIONS: RequestHandler = createPreflightHandler('GET, OPTIONS');
