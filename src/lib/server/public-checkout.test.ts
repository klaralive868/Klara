import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { checkout, parseCheckoutForm } from './public-checkout';

const VALID_FIELDS = {
	name: 'Jane Shopper',
	email: 'jane@example.com',
	phone: '555-0100',
	deliveryAddress: '123 Main St',
	paymentMethod: 'cod',
	items: [{ itemId: 'item-1', size: 'M', quantity: 2 }]
};

describe('parseCheckoutForm', () => {
	it('parses valid input', () => {
		const result = parseCheckoutForm(VALID_FIELDS);
		expect(result).toEqual({
			ok: true,
			value: {
				name: 'Jane Shopper',
				email: 'jane@example.com',
				phone: '555-0100',
				deliveryAddress: '123 Main St',
				paymentMethod: 'cod',
				items: [{ itemId: 'item-1', size: 'M', quantity: 2 }]
			}
		});
	});

	it('treats a blank phone as null', () => {
		const result = parseCheckoutForm({ ...VALID_FIELDS, phone: ' ' });
		expect(result.ok && result.value.phone).toBeNull();
	});

	it('normalizes an absent size to null (sizeless item)', () => {
		const result = parseCheckoutForm({
			...VALID_FIELDS,
			items: [{ itemId: 'item-1', quantity: 1 }]
		});
		expect(result.ok && result.value.items[0].size).toBeNull();
	});

	it('rejects a blank name', () => {
		const result = parseCheckoutForm({ ...VALID_FIELDS, name: '  ' });
		expect(result).toEqual({ ok: false, message: 'Enter your name.' });
	});

	it('rejects a malformed email', () => {
		const result = parseCheckoutForm({ ...VALID_FIELDS, email: 'not-an-email' });
		expect(result).toEqual({ ok: false, message: 'Enter a valid email address.' });
	});

	it('rejects a blank delivery address', () => {
		const result = parseCheckoutForm({ ...VALID_FIELDS, deliveryAddress: '  ' });
		expect(result).toEqual({ ok: false, message: 'Enter a delivery address.' });
	});

	it('rejects an invalid payment method instead of coercing it', () => {
		const result = parseCheckoutForm({ ...VALID_FIELDS, paymentMethod: 'cash' });
		expect(result).toEqual({ ok: false, message: 'Select a valid payment method.' });
	});

	it('rejects an empty cart', () => {
		const result = parseCheckoutForm({ ...VALID_FIELDS, items: [] });
		expect(result).toEqual({ ok: false, message: 'Your cart is empty.' });
	});

	it('rejects a non-array items field', () => {
		const result = parseCheckoutForm({ ...VALID_FIELDS, items: 'not-an-array' });
		expect(result).toEqual({ ok: false, message: 'Your cart is empty.' });
	});

	it('rejects a cart line missing itemId', () => {
		const result = parseCheckoutForm({ ...VALID_FIELDS, items: [{ quantity: 1 }] });
		expect(result).toEqual({ ok: false, message: 'One or more cart items are invalid.' });
	});

	it('rejects a cart line with a zero quantity', () => {
		const result = parseCheckoutForm({
			...VALID_FIELDS,
			items: [{ itemId: 'item-1', quantity: 0 }]
		});
		expect(result).toEqual({ ok: false, message: 'One or more cart items are invalid.' });
	});

	it('rejects a cart line with a non-numeric quantity instead of coercing it', () => {
		const result = parseCheckoutForm({
			...VALID_FIELDS,
			items: [{ itemId: 'item-1', quantity: 'two' }]
		});
		expect(result).toEqual({ ok: false, message: 'One or more cart items are invalid.' });
	});

	it('rejects an array field value instead of coercing it with String()', () => {
		const result = parseCheckoutForm({ ...VALID_FIELDS, email: ['jane@example.com'] });
		expect(result).toEqual({ ok: false, message: 'Invalid field value.' });
	});
});

function chain(response: { data: unknown; error: unknown }) {
	const node: Record<string, unknown> = {
		select: () => node,
		eq: () => node,
		ilike: () => node,
		limit: () => node,
		in: () => node,
		maybeSingle: async () => response,
		then: (resolve: (value: typeof response) => void) => resolve(response)
	};
	return node;
}

const CATALOG_ITEM = { id: 'item-1', name: 'Home Jersey', price_cents: 6500 };
const EXISTING_CUSTOMER = { id: 'customer-1' };

function fakeSupabase(opts: {
	catalogItems?: { data: unknown; error: unknown };
	rpcResponse?: { data: unknown; error: unknown };
}): { client: SupabaseClient; rpcCalls: Array<{ fn: string; args: unknown }> } {
	const rpcCalls: Array<{ fn: string; args: unknown }> = [];
	const client = {
		from: (table: string) => {
			if (table === 'catalog_items') {
				return chain(opts.catalogItems ?? { data: [CATALOG_ITEM], error: null });
			}
			if (table === 'customers') {
				return chain({ data: EXISTING_CUSTOMER, error: null });
			}
			return chain({ data: null, error: null });
		},
		rpc: async (fn: string, args: unknown) => {
			rpcCalls.push({ fn, args });
			return opts.rpcResponse ?? { data: 'order-1', error: null };
		}
	} as unknown as SupabaseClient;
	return { client, rpcCalls };
}

describe('checkout', () => {
	it('resolves real item name/price server-side and calls checkout_cart', async () => {
		const { client, rpcCalls } = fakeSupabase({});
		const parsed = parseCheckoutForm(VALID_FIELDS);
		if (!parsed.ok) throw new Error('expected valid');

		const result = await checkout(client, 'org-1', parsed.value);
		expect(result).toEqual({ ok: true, orderId: 'order-1' });
		expect(rpcCalls).toHaveLength(1);
		expect(rpcCalls[0].fn).toBe('checkout_cart');
		expect(rpcCalls[0].args).toMatchObject({
			p_organization_id: 'org-1',
			p_customer_id: 'customer-1',
			p_items: [
				{ item_id: 'item-1', name: 'Home Jersey', size: 'M', quantity: 2, unit_price_cents: 6500 }
			],
			p_total_amount_cents: 13000
		});
	});

	it('rejects a cart item that does not resolve to a real, published, org-scoped item', async () => {
		const { client } = fakeSupabase({ catalogItems: { data: [], error: null } });
		const parsed = parseCheckoutForm(VALID_FIELDS);
		if (!parsed.ok) throw new Error('expected valid');

		const result = await checkout(client, 'org-1', parsed.value);
		expect(result).toEqual({ ok: false, status: 400, message: 'Item not found: item-1.' });
	});

	it('surfaces an insufficient-stock failure as a specific 400 naming the item', async () => {
		const { client } = fakeSupabase({
			rpcResponse: {
				data: null,
				error: { message: 'insufficient_stock:item-1:M' }
			}
		});
		const parsed = parseCheckoutForm(VALID_FIELDS);
		if (!parsed.ok) throw new Error('expected valid');

		const result = await checkout(client, 'org-1', parsed.value);
		expect(result).toEqual({
			ok: false,
			status: 400,
			message: 'Insufficient stock for Home Jersey (M).'
		});
	});

	it('returns a 500 on an unrecognized RPC failure', async () => {
		const { client } = fakeSupabase({
			rpcResponse: { data: null, error: { message: 'connection reset' } }
		});
		const parsed = parseCheckoutForm(VALID_FIELDS);
		if (!parsed.ok) throw new Error('expected valid');

		const result = await checkout(client, 'org-1', parsed.value);
		expect(result).toEqual({
			ok: false,
			status: 500,
			message: 'Something went wrong. Please try again.'
		});
	});
});
