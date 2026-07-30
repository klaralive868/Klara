import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getPublishedResource, listPublishedResources } from './public-resources';

// A chainable stand-in that resolves to `response` regardless of which
// filter/order methods get called on it — public-resources.ts's queries
// differ in shape (list vs. single, resources vs. resource_images) but all
// terminate by being awaited directly (no .maybeSingle() call to hook for
// the list queries), so making the chain itself thenable covers every case.
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

// Keyed by table name so a single fake client can answer both the
// `resources` query and the `resource_images` query a function makes in
// sequence, with independently configurable responses per test.
function fakeSupabase(responses: {
	resources?: { data: unknown; error: unknown };
	resource_images?: { data: unknown; error: unknown };
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

const RESOURCE_ROW = {
	id: 'r1',
	name: 'Bali Tour',
	description: 'A week in Bali',
	departure_date: '2026-08-12',
	return_date: '2026-08-19',
	price_cents: 189900
};

describe('listPublishedResources', () => {
	it('returns images: [] for a resource with no images', async () => {
		const supabase = fakeSupabase({
			resources: { data: [RESOURCE_ROW], error: null },
			resource_images: { data: [], error: null }
		});
		const result = await listPublishedResources(supabase, 'org-1');
		expect(result).toEqual([{ ...toCamel(RESOURCE_ROW), images: [] }]);
	});

	it('groups images by resource and sorts the primary one first', async () => {
		const supabase = fakeSupabase({
			resources: { data: [RESOURCE_ROW], error: null },
			resource_images: {
				data: [
					{ id: 'img-1', resource_id: 'r1', storage_path: 'r1/a.jpg', is_primary: false },
					{ id: 'img-2', resource_id: 'r1', storage_path: 'r1/b.jpg', is_primary: true }
				],
				error: null
			}
		});
		const result = await listPublishedResources(supabase, 'org-1');
		expect(result[0].images).toEqual([
			{ id: 'img-2', isPrimary: true, url: 'https://cdn.example/r1/b.jpg' },
			{ id: 'img-1', isPrimary: false, url: 'https://cdn.example/r1/a.jpg' }
		]);
	});

	it('returns an empty list, not an error, when the resources query fails', async () => {
		const supabase = fakeSupabase({ resources: { data: null, error: new Error('boom') } });
		const result = await listPublishedResources(supabase, 'org-1');
		expect(result).toEqual([]);
	});
});

describe('getPublishedResource', () => {
	it('returns images: [] for a resource with no images', async () => {
		const supabase = fakeSupabase({
			resources: { data: RESOURCE_ROW, error: null },
			resource_images: { data: [], error: null }
		});
		const result = await getPublishedResource(supabase, 'org-1', 'r1');
		expect(result).toEqual({ ...toCamel(RESOURCE_ROW), images: [] });
	});

	it('returns real image URLs when images exist', async () => {
		const supabase = fakeSupabase({
			resources: { data: RESOURCE_ROW, error: null },
			resource_images: {
				data: [{ id: 'img-1', resource_id: 'r1', storage_path: 'r1/a.jpg', is_primary: true }],
				error: null
			}
		});
		const result = await getPublishedResource(supabase, 'org-1', 'r1');
		expect(result?.images).toEqual([
			{ id: 'img-1', isPrimary: true, url: 'https://cdn.example/r1/a.jpg' }
		]);
	});

	it('returns null when the resource does not exist', async () => {
		const supabase = fakeSupabase({ resources: { data: null, error: null } });
		const result = await getPublishedResource(supabase, 'org-1', 'missing');
		expect(result).toBeNull();
	});
});

function toCamel(row: typeof RESOURCE_ROW) {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		departureDate: row.departure_date,
		returnDate: row.return_date,
		priceCents: row.price_cents
	};
}
