import { resolvePublicApiRequest, jsonOk, createPreflightHandler } from '$lib/server/public-api';
import { listPublishedResources } from '$lib/server/public-resources';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const result = await resolvePublicApiRequest(event);
	if (!result.ok) {
		return result.response;
	}
	const { organization, origin, admin } = result.context;

	const resources = await listPublishedResources(admin, organization.id);
	return jsonOk(resources, { origin });
};

export const OPTIONS: RequestHandler = createPreflightHandler('GET, OPTIONS');
