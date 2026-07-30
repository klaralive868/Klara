export type OrderStatus = 'pending' | 'confirmed' | 'fulfilled' | 'cancelled';

export interface OrderLine {
	itemId: string;
	name: string;
	size: string | null;
	quantity: number;
	unitPriceCents: number;
}

export interface Order {
	id: string;
	customerName: string;
	customerEmail: string | null;
	items: OrderLine[];
	paymentMethod: 'bank_transfer' | 'cod';
	deliveryAddress: string;
	totalAmountCents: number;
	status: OrderStatus;
	createdAt: string;
}

// Raw shape of a line within the `items` jsonb column (snake_case, as
// written by checkout_cart — see 20260730080000_checkout_stock_functions.sql).
interface OrderLineRow {
	item_id: string;
	name: string;
	size: string | null;
	quantity: number;
	unit_price_cents: number;
}

export const ORDER_SELECT =
	'id, items, payment_method, delivery_address, total_amount_cents, status, created_at, customers(full_name, email)';

export interface OrderRow {
	id: string;
	items: OrderLineRow[];
	payment_method: 'bank_transfer' | 'cod';
	delivery_address: string;
	total_amount_cents: number;
	status: OrderStatus;
	created_at: string;
	customers: { full_name: string; email: string | null } | null;
}

export function orderFromRow(row: OrderRow): Order {
	return {
		id: row.id,
		customerName: row.customers?.full_name ?? 'Unknown customer',
		customerEmail: row.customers?.email ?? null,
		items: row.items.map((line) => ({
			itemId: line.item_id,
			name: line.name,
			size: line.size,
			quantity: line.quantity,
			unitPriceCents: line.unit_price_cents
		})),
		paymentMethod: row.payment_method,
		deliveryAddress: row.delivery_address,
		totalAmountCents: row.total_amount_cents,
		status: row.status,
		createdAt: row.created_at
	};
}

export function orderStatusVariant(status: OrderStatus) {
	if (status === 'confirmed') return 'default';
	if (status === 'fulfilled') return 'secondary';
	if (status === 'cancelled') return 'destructive';
	return 'outline';
}

export function orderItemsSummary(items: OrderLine[]): string {
	return items
		.map((line) => `${line.quantity}× ${line.name}${line.size ? ` (${line.size})` : ''}`)
		.join(', ');
}
