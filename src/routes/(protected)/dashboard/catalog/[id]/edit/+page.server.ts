import { error } from '@sveltejs/kit';
import { getPlaceholderItem } from '$lib/catalog/placeholder-items';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const item = getPlaceholderItem(params.id);
	if (!item) {
		error(404, 'Item not found');
	}
	return { item };
};
