import { PLACEHOLDER_CATEGORIES } from '$lib/catalog/placeholder-categories';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return { categories: PLACEHOLDER_CATEGORIES };
};
