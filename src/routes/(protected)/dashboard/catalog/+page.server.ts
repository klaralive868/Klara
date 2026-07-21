import { PLACEHOLDER_ITEMS } from '$lib/catalog/placeholder-items';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return { items: PLACEHOLDER_ITEMS };
};
