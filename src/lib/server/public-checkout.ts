import type { SupabaseClient } from '@supabase/supabase-js';
import { EMAIL_PATTERN } from '$lib/email';
import { PG_INTEGER_MAX } from '$lib/server/pg';
import { checkRateLimit, rateLimitKey } from '$lib/server/rate-limit';
import { findOrCreateCustomer } from '$lib/server/public-booking';

const CHECKOUT_RATE_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };
// Same reasoning as public-inquiry.ts's IP-only bucket: email is
// attacker-controlled input, not an authenticated identity, so this caps
// total checkout attempts per IP regardless of how many emails get cycled
// through.
const CHECKOUT_IP_RATE_LIMIT = { limit: 20, windowMs: 15 * 60 * 1000 };

export function checkCheckoutRateLimit(ip: string, email: string): boolean {
	const ipKey = rateLimitKey('checkout-ip', ip, '');
	if (!checkRateLimit(ipKey, CHECKOUT_IP_RATE_LIMIT)) {
		return false;
	}

	const key = rateLimitKey('checkout', ip, email.toLowerCase());
	return checkRateLimit(key, CHECKOUT_RATE_LIMIT);
}

export type PaymentMethod = 'bank_transfer' | 'cod';

export interface CartLine {
	itemId: string;
	size: string | null;
	quantity: number;
}

export interface ParsedCheckoutForm {
	name: string;
	email: string;
	phone: string | null;
	deliveryAddress: string;
	paymentMethod: PaymentMethod;
	items: CartLine[];
}

export type ParseCheckoutFormResult =
	{ ok: true; value: ParsedCheckoutForm } | { ok: false; message: string };

// Same reasoning as every other public-api parser in this app: a JSON body
// can contain arbitrary types, so scalar fields are rejected outright
// (never silently stringified) when they arrive as an array/object.
function toFieldString(value: unknown): string | null {
	if (value === null || value === undefined) {
		return '';
	}
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}
	return null;
}

function parseCartLine(value: unknown): CartLine | null {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		return null;
	}
	const record = value as Record<string, unknown>;

	const itemId = toFieldString(record.itemId);
	if (itemId === null || !itemId.trim()) {
		return null;
	}

	// size is optional (sizeless items) — absent/null is the sizeless
	// convention (catalog_item_stock's `size IS NULL` row), never coerced
	// to the string "null".
	let size: string | null = null;
	if (record.size !== null && record.size !== undefined) {
		const sizeField = toFieldString(record.size);
		if (sizeField === null) {
			return null;
		}
		size = sizeField.trim() || null;
	}

	const quantityField = toFieldString(record.quantity);
	if (quantityField === null || !/^\d+$/.test(quantityField.trim())) {
		return null;
	}
	const quantity = Number(quantityField.trim());
	if (quantity <= 0 || quantity > PG_INTEGER_MAX) {
		return null;
	}

	return { itemId: itemId.trim(), size, quantity };
}

export function parseCheckoutForm(fields: Record<string, unknown>): ParseCheckoutFormResult {
	const nameField = toFieldString(fields.name);
	const emailField = toFieldString(fields.email);
	const phoneField = toFieldString(fields.phone);
	const deliveryAddressField = toFieldString(fields.deliveryAddress);
	const paymentMethodField = toFieldString(fields.paymentMethod);

	if (
		nameField === null ||
		emailField === null ||
		phoneField === null ||
		deliveryAddressField === null ||
		paymentMethodField === null
	) {
		return { ok: false, message: 'Invalid field value.' };
	}

	const name = nameField.trim();
	const email = emailField.trim();
	const phone = phoneField.trim();
	const deliveryAddress = deliveryAddressField.trim();
	const paymentMethod = paymentMethodField.trim();

	if (!name) {
		return { ok: false, message: 'Enter your name.' };
	}
	if (!EMAIL_PATTERN.test(email)) {
		return { ok: false, message: 'Enter a valid email address.' };
	}
	if (!deliveryAddress) {
		return { ok: false, message: 'Enter a delivery address.' };
	}
	if (paymentMethod !== 'bank_transfer' && paymentMethod !== 'cod') {
		return { ok: false, message: 'Select a valid payment method.' };
	}

	if (!Array.isArray(fields.items) || fields.items.length === 0) {
		return { ok: false, message: 'Your cart is empty.' };
	}

	const items: CartLine[] = [];
	for (const raw of fields.items) {
		const line = parseCartLine(raw);
		if (!line) {
			return { ok: false, message: 'One or more cart items are invalid.' };
		}
		items.push(line);
	}

	return {
		ok: true,
		value: {
			name,
			email,
			phone: phone || null,
			deliveryAddress,
			paymentMethod: paymentMethod as PaymentMethod,
			items
		}
	};
}

export interface CatalogItemLookup {
	id: string;
	name: string;
	price_cents: number;
}

export type CheckoutResult =
	{ ok: true; orderId: string } | { ok: false; status: 400 | 500; message: string };

// Resolves every cart line against real, org-scoped, published catalog
// items — item name/price are always read from the database here, never
// trusted from the request body, so a tampered client-supplied price can
// never reach an order. Runs the whole cart's stock check/decrement and the
// order insert as one atomic Postgres transaction (checkout_cart) — see
// that function's own comment for why this, not JS-orchestrated rollback.
export async function checkout(
	admin: SupabaseClient,
	organizationId: string,
	parsed: ParsedCheckoutForm
): Promise<CheckoutResult> {
	const itemIds = parsed.items.map((line) => line.itemId);
	const { data: catalogItems, error: itemsError } = await admin
		.from('catalog_items')
		.select('id, name, price_cents')
		.eq('organization_id', organizationId)
		.eq('status', 'published')
		.in('id', itemIds);

	if (itemsError) {
		console.error('checkout: failed to load catalog items', itemsError);
		return { ok: false, status: 500, message: 'Something went wrong. Please try again.' };
	}

	const itemById = new Map((catalogItems as CatalogItemLookup[]).map((item) => [item.id, item]));
	for (const line of parsed.items) {
		if (!itemById.has(line.itemId)) {
			return { ok: false, status: 400, message: `Item not found: ${line.itemId}.` };
		}
	}

	const orderItems = parsed.items.map((line) => {
		const item = itemById.get(line.itemId)!;
		return {
			item_id: line.itemId,
			name: item.name,
			size: line.size,
			quantity: line.quantity,
			unit_price_cents: item.price_cents
		};
	});
	const totalAmountCents = orderItems.reduce(
		(sum, line) => sum + line.unit_price_cents * line.quantity,
		0
	);

	const customer = await findOrCreateCustomer(
		admin,
		organizationId,
		parsed.name,
		parsed.email,
		parsed.phone,
		'order'
	);
	if (!customer) {
		return { ok: false, status: 500, message: 'Something went wrong. Please try again.' };
	}

	const { data: orderId, error: checkoutError } = await admin.rpc('checkout_cart', {
		p_organization_id: organizationId,
		p_customer_id: customer.id,
		p_items: orderItems,
		p_payment_method: parsed.paymentMethod,
		p_delivery_address: parsed.deliveryAddress,
		p_total_amount_cents: totalAmountCents
	});

	if (checkoutError) {
		const match = /insufficient_stock:([^:]+):(.*)/.exec(checkoutError.message);
		if (match) {
			const [, failedItemId, failedSize] = match;
			const item = itemById.get(failedItemId);
			const label = item?.name ?? failedItemId;
			const sizeSuffix = failedSize ? ` (${failedSize})` : '';
			return {
				ok: false,
				status: 400,
				message: `Insufficient stock for ${label}${sizeSuffix}.`
			};
		}
		console.error('checkout: checkout_cart failed', checkoutError);
		return { ok: false, status: 500, message: 'Something went wrong. Please try again.' };
	}

	return { ok: true, orderId: orderId as string };
}
