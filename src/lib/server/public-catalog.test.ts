import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getPublishedCatalogItem, listPublishedCatalogItems } from './public-catalog';

function chain(response: { data: unknown; error: unknown }) {
	const node: Record<string, unknown> = {
		select: () => node,
		eq: () => node,
		in: () => node,
		order: () => node,
		maybeSingle: async () => response,
		then: (resolve: (value: typeof response) => void) => resolve(response)
	};
	return node;
}

function fakeSupabase(responses: {
	catalog_items?: { data: unknown; error: unknown };
	catalog_item_stock?: { data: unknown; error: unknown };
	catalog_item_images?: { data: unknown; error: unknown };
}): SupabaseClient {
	return {
		from: (table: string) =>
			chain(responses[table as keyof typeof responses] ?? { data: [], error: null }),
		storage: {
			from: () => ({
				getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.example/${path}` } })
			})
		}
	} as unknown as SupabaseClient;
}

const ITEM_ROW = {
	id: 'item-1',
	name: 'Home Jersey',
	description: 'Mesh fabric',
	price_cents: 6500,
	material_type: 'jersey',
	unlimited_stock: false
};

describe('listPublishedCatalogItems', () => {
	it('builds stockBySize from in-stock rows and computes inStock', async () => {
		const supabase = fakeSupabase({
			catalog_items: { data: [ITEM_ROW], error: null },
			catalog_item_stock: {
				data: [
					{ item_id: 'item-1', size: 'M', quantity: 3 },
					{ item_id: 'item-1', size: 'L', quantity: 0 }
				],
				error: null
			},
			catalog_item_images: { data: [], error: null }
		});
		const result = await listPublishedCatalogItems(supabase, 'org-1');
		expect(result).toEqual([
			{
				id: 'item-1',
				name: 'Home Jersey',
				description: 'Mesh fabric',
				priceCents: 6500,
				materialType: 'jersey',
				images: [],
				unlimitedStock: false,
				inStock: true,
				stockBySize: { M: true, L: false }
			}
		]);
	});

	it('returns stockBySize: null and inStock: false for a sizeless item with no stock', async () => {
		const supabase = fakeSupabase({
			catalog_items: { data: [ITEM_ROW], error: null },
			catalog_item_stock: { data: [], error: null },
			catalog_item_images: { data: [], error: null }
		});
		const result = await listPublishedCatalogItems(supabase, 'org-1');
		expect(result[0].stockBySize).toBeNull();
		expect(result[0].inStock).toBe(false);
	});

	it('treats a sizeless item with a null-size stock row as in stock', async () => {
		const supabase = fakeSupabase({
			catalog_items: { data: [ITEM_ROW], error: null },
			catalog_item_stock: { data: [{ item_id: 'item-1', size: null, quantity: 5 }], error: null },
			catalog_item_images: { data: [], error: null }
		});
		const result = await listPublishedCatalogItems(supabase, 'org-1');
		expect(result[0].stockBySize).toBeNull();
		expect(result[0].inStock).toBe(true);
	});

	it('unlimited_stock items are always inStock regardless of stock rows', async () => {
		const supabase = fakeSupabase({
			catalog_items: { data: [{ ...ITEM_ROW, unlimited_stock: true }], error: null },
			catalog_item_stock: { data: [], error: null },
			catalog_item_images: { data: [], error: null }
		});
		const result = await listPublishedCatalogItems(supabase, 'org-1');
		expect(result[0].unlimitedStock).toBe(true);
		expect(result[0].inStock).toBe(true);
	});

	it('sorts images primary-first', async () => {
		const supabase = fakeSupabase({
			catalog_items: { data: [ITEM_ROW], error: null },
			catalog_item_stock: { data: [], error: null },
			catalog_item_images: {
				data: [
					{ id: 'img-1', item_id: 'item-1', storage_path: 'a.jpg', is_primary: false },
					{ id: 'img-2', item_id: 'item-1', storage_path: 'b.jpg', is_primary: true }
				],
				error: null
			}
		});
		const result = await listPublishedCatalogItems(supabase, 'org-1');
		expect(result[0].images).toEqual([
			{ id: 'img-2', isPrimary: true, url: 'https://cdn.example/b.jpg' },
			{ id: 'img-1', isPrimary: false, url: 'https://cdn.example/a.jpg' }
		]);
	});

	it('returns an empty list, not an error, when the items query fails', async () => {
		const supabase = fakeSupabase({ catalog_items: { data: null, error: new Error('boom') } });
		const result = await listPublishedCatalogItems(supabase, 'org-1');
		expect(result).toEqual([]);
	});
});

describe('getPublishedCatalogItem', () => {
	it('returns null when the item does not exist', async () => {
		const supabase = fakeSupabase({ catalog_items: { data: null, error: null } });
		const result = await getPublishedCatalogItem(supabase, 'org-1', 'missing');
		expect(result).toBeNull();
	});

	it('returns the item with its stock and images', async () => {
		const supabase = fakeSupabase({
			catalog_items: { data: ITEM_ROW, error: null },
			catalog_item_stock: { data: [{ item_id: 'item-1', size: 'M', quantity: 2 }], error: null },
			catalog_item_images: { data: [], error: null }
		});
		const result = await getPublishedCatalogItem(supabase, 'org-1', 'item-1');
		expect(result?.stockBySize).toEqual({ M: true });
		expect(result?.inStock).toBe(true);
	});
});
