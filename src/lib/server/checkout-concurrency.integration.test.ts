// Integration tests — real local Supabase Postgres, not a fake client (see
// vitest.integration.config.ts). What this proves genuinely can't be shown
// with a mocked client: atomicity comes from Postgres's own row-level
// locking inside decrement_item_stock/checkout_cart
// (20260730080000_checkout_stock_functions.sql), and only a real concurrent
// race against a real database can demonstrate that two simultaneous
// checkouts for the last unit don't both succeed.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { checkout, parseCheckoutForm } from './public-checkout';

function createAdminClient(): SupabaseClient {
	process.loadEnvFile?.('.env');
	const url = process.env.PUBLIC_SUPABASE_URL;
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!url || !serviceRoleKey) {
		throw new Error(
			'PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (local Supabase running) for integration tests'
		);
	}
	return createClient(url, serviceRoleKey, {
		auth: { autoRefreshToken: false, persistSession: false }
	});
}

const ORG_SLUG = 'checkout-integration-org';
let admin: SupabaseClient;
let organizationId: string;

async function createItem(opts: { name: string; stock: number | null; unlimited?: boolean }) {
	const { data: item, error } = await admin
		.from('catalog_items')
		.insert({
			organization_id: organizationId,
			name: opts.name,
			price_cents: 1000,
			material_type: 'jersey',
			status: 'published',
			unlimited_stock: opts.unlimited ?? false
		})
		.select('id')
		.single();
	if (error || !item) throw new Error(`item create failed: ${error?.message}`);

	if (opts.stock !== null) {
		const { error: stockError } = await admin
			.from('catalog_item_stock')
			.insert({ item_id: item.id, size: 'M', quantity: opts.stock });
		if (stockError) throw new Error(`stock create failed: ${stockError.message}`);
	}

	return item.id as string;
}

async function getStockQuantity(itemId: string): Promise<number | null> {
	const { data } = await admin
		.from('catalog_item_stock')
		.select('quantity')
		.eq('item_id', itemId)
		.eq('size', 'M')
		.maybeSingle();
	return data?.quantity ?? null;
}

function checkoutFields(itemId: string, email: string, quantity: number) {
	return {
		name: 'Test Shopper',
		email,
		phone: null,
		deliveryAddress: '123 Test St',
		paymentMethod: 'cod',
		items: [{ itemId, size: 'M', quantity }]
	};
}

beforeAll(async () => {
	admin = createAdminClient();
	await admin.from('organizations').delete().eq('slug', ORG_SLUG);
	const { data: org, error } = await admin
		.from('organizations')
		.insert({ name: 'Checkout Integration Org', slug: ORG_SLUG })
		.select('id')
		.single();
	if (error || !org) throw new Error(`org create failed: ${error?.message}`);
	organizationId = org.id;
});

afterAll(async () => {
	await admin.from('organizations').delete().eq('id', organizationId);
});

describe('checkout stock atomicity', () => {
	it('decrements stock correctly on a sufficient-stock checkout', async () => {
		const itemId = await createItem({ name: 'Sufficient Stock Item', stock: 5 });
		const parsed = parseCheckoutForm(checkoutFields(itemId, 'sufficient@example.com', 2));
		if (!parsed.ok) throw new Error('expected valid parse');

		const result = await checkout(admin, organizationId, parsed.value);
		expect(result.ok).toBe(true);
		expect(await getStockQuantity(itemId)).toBe(3);
	});

	it('rejects an insufficient-stock checkout and leaves quantity unchanged', async () => {
		const itemId = await createItem({ name: 'Insufficient Stock Item', stock: 1 });
		const parsed = parseCheckoutForm(checkoutFields(itemId, 'insufficient@example.com', 5));
		if (!parsed.ok) throw new Error('expected valid parse');

		const result = await checkout(admin, organizationId, parsed.value);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.status).toBe(400);
		}
		// The critical assertion: no partial mutation. A check-then-write bug
		// would have decremented before discovering the shortfall.
		expect(await getStockQuantity(itemId)).toBe(1);
	});

	it('exactly one of two genuinely concurrent checkouts for the last unit succeeds', async () => {
		const itemId = await createItem({ name: 'Last Unit Item', stock: 1 });
		const parsedA = parseCheckoutForm(checkoutFields(itemId, 'race-a@example.com', 1));
		const parsedB = parseCheckoutForm(checkoutFields(itemId, 'race-b@example.com', 1));
		if (!parsedA.ok || !parsedB.ok) throw new Error('expected valid parse');

		const [resultA, resultB] = await Promise.all([
			checkout(admin, organizationId, parsedA.value),
			checkout(admin, organizationId, parsedB.value)
		]);

		const outcomes = [resultA.ok, resultB.ok];
		expect(outcomes.filter(Boolean)).toHaveLength(1);
		expect(outcomes.filter((ok) => !ok)).toHaveLength(1);
		// Final stock must be 0, not -1 — proves the loser's decrement never
		// applied, not just that its RPC call returned an error.
		expect(await getStockQuantity(itemId)).toBe(0);
	});

	it('never rejects an unlimited-stock item, regardless of quantity', async () => {
		const itemId = await createItem({ name: 'Unlimited Item', stock: null, unlimited: true });
		const parsed = parseCheckoutForm(checkoutFields(itemId, 'unlimited@example.com', 1000));
		if (!parsed.ok) throw new Error('expected valid parse');

		const result = await checkout(admin, organizationId, parsed.value);
		expect(result.ok).toBe(true);
	});

	it("rejects a checkout against another organization's item", async () => {
		const { data: otherOrg, error: otherOrgError } = await admin
			.from('organizations')
			.insert({ name: 'Other Checkout Org', slug: 'checkout-integration-other-org' })
			.select('id')
			.single();
		if (otherOrgError || !otherOrg) throw new Error('other org create failed');

		const itemId = await createItem({ name: 'Cross Org Item', stock: 5 });
		const parsed = parseCheckoutForm(checkoutFields(itemId, 'crossorg@example.com', 1));
		if (!parsed.ok) throw new Error('expected valid parse');

		// Checking out against otherOrg's id while the item actually belongs
		// to organizationId — the item must not resolve.
		const result = await checkout(admin, otherOrg.id, parsed.value);
		expect(result).toEqual({ ok: false, status: 400, message: `Item not found: ${itemId}.` });

		await admin.from('organizations').delete().eq('id', otherOrg.id);
	});
});
