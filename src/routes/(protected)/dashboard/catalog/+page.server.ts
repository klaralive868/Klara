import { fail } from '@sveltejs/kit';
import {
	catalogItemFromRow,
	type CatalogItemListRow,
	type CatalogItemRow,
	type CatalogItemStatus
} from '$lib/catalog/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { data, error } = await locals.supabase
		.from('catalog_items')
		.select('id, name, description, price_cents, material_type, status')
		.order('created_at', { ascending: false });

	if (error) {
		// RLS already scopes this to the caller's own organization — a query
		// error here is unexpected infra failure, not an access-control gap.
		console.error('catalog: failed to load items', error);
		return { items: [] as CatalogItemListRow[] };
	}

	const items = (data as CatalogItemRow[]).map(catalogItemFromRow);
	const itemIds = items.map((item) => item.id);

	const stockBySize = new Map<string, Record<string, number>>();
	if (itemIds.length > 0) {
		const { data: stockRows, error: stockError } = await locals.supabase
			.from('catalog_item_stock')
			.select('item_id, size, quantity')
			.in('item_id', itemIds);

		if (stockError) {
			console.error('catalog: failed to load item stock', stockError);
		} else {
			for (const row of stockRows ?? []) {
				const bySize = stockBySize.get(row.item_id) ?? {};
				bySize[row.size ?? 'quantity'] = row.quantity as number;
				stockBySize.set(row.item_id, bySize);
			}
		}
	}

	const itemsWithStock: CatalogItemListRow[] = items.map((item) => {
		const bySize = stockBySize.get(item.id) ?? {};
		return {
			...item,
			stockBySize: bySize,
			stockTotal: Object.values(bySize).reduce((sum, qty) => sum + qty, 0)
		};
	});

	return { items: itemsWithStock };
};

const BULK_TARGET_STATUSES = ['published', 'archived'] as const;
type BulkTargetStatus = (typeof BULK_TARGET_STATUSES)[number];

function isBulkTargetStatus(value: string): value is BulkTargetStatus {
	return (BULK_TARGET_STATUSES as readonly string[]).includes(value);
}

export const actions: Actions = {
	// Bulk archive is a plain status update (archiving doesn't have
	// preconditions). Bulk publish reuses each item's own
	// publish_catalog_item RPC — including the "needs at least one
	// category" gate the single-item Publish button already enforces — so
	// an item with no categories tagged is reported as skipped rather than
	// silently published with nothing to show for it. There's no per-item
	// category picker in this bulk flow, so a to-be-published item re-sends
	// whatever categories it already has tagged (unmodified), not a fresh
	// selection.
	bulkUpdateStatus: async ({ request, locals }) => {
		const formData = await request.formData();
		const itemIds = formData.getAll('itemIds').map(String).filter(Boolean);
		const status = String(formData.get('status') ?? '');

		if (itemIds.length === 0) {
			return fail(400, { bulkMessage: 'Select at least one item.' });
		}
		if (!isBulkTargetStatus(status)) {
			return fail(400, { bulkMessage: 'Choose a valid status.' });
		}

		if (status === 'archived') {
			const { data, error: updateError } = await locals.supabase
				.from('catalog_items')
				.update({ status: 'archived' satisfies CatalogItemStatus })
				.in('id', itemIds)
				.select('id');

			if (updateError) {
				return fail(500, { bulkMessage: 'Could not archive the selected items. Please try again.' });
			}

			return { success: true, bulkMessage: `${data?.length ?? 0} item(s) archived.` };
		}

		// status === 'published'
		let publishedCount = 0;
		let skippedCount = 0;
		for (const itemId of itemIds) {
			const { data: tags, error: tagsError } = await locals.supabase
				.from('catalog_item_categories')
				.select('category_id')
				.eq('item_id', itemId);

			if (tagsError || !tags || tags.length === 0) {
				skippedCount++;
				continue;
			}

			const { data: published, error: publishError } = await locals.supabase.rpc(
				'publish_catalog_item',
				{ p_item_id: itemId, p_category_ids: tags.map((tag) => tag.category_id) }
			);

			if (publishError || !published) {
				skippedCount++;
				continue;
			}

			publishedCount++;
		}

		const parts = [`${publishedCount} item(s) published.`];
		if (skippedCount > 0) {
			parts.push(`${skippedCount} skipped (already published, or needs a category first).`);
		}

		return { success: publishedCount > 0, bulkMessage: parts.join(' ') };
	}
};
