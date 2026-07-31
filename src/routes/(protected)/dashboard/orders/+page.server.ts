import { fail } from '@sveltejs/kit';
import {
	ORDER_SELECT,
	ORDER_STATUS_TRANSITIONS,
	orderFromRow,
	type OrderRow,
	type OrderStatus
} from '$lib/orders/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// RLS already scopes this to the caller's own organization — a query
	// error here is unexpected infra failure, not an access-control gap
	// (same reasoning as the catalog list loader).
	const { data, error } = await locals.supabase
		.from('orders')
		.select(ORDER_SELECT)
		.order('created_at', { ascending: false });

	if (error) {
		console.error('orders: failed to load orders', error);
		return { orders: [] };
	}

	return { orders: (data as unknown as OrderRow[]).map(orderFromRow) };
};

const ORDER_STATUSES = Object.keys(ORDER_STATUS_TRANSITIONS) as OrderStatus[];

function isOrderStatus(value: string): value is OrderStatus {
	return (ORDER_STATUSES as string[]).includes(value);
}

export const actions: Actions = {
	// No inventory action here: stock is already decremented atomically at
	// checkout time (checkout_cart), before the order exists — a status
	// change is purely a label an agent applies after verifying payment /
	// dispatching delivery, not a trigger for further stock mutation.
	updateStatus: async ({ request, locals }) => {
		const formData = await request.formData();
		const orderId = String(formData.get('orderId') ?? '');
		const status = String(formData.get('status') ?? '');

		if (!orderId) {
			return fail(400, { statusMessage: 'Missing order.' });
		}
		if (!isOrderStatus(status)) {
			return fail(400, { statusMessage: 'Choose a valid status.' });
		}

		const { data: current, error: currentError } = await locals.supabase
			.from('orders')
			.select('status')
			.eq('id', orderId)
			.maybeSingle();

		if (currentError || !current) {
			return fail(404, { statusMessage: 'Order not found.' });
		}

		const currentStatus = current.status as OrderStatus;
		if (!ORDER_STATUS_TRANSITIONS[currentStatus].includes(status)) {
			return fail(400, {
				statusMessage: `Can't move an order from "${currentStatus}" to "${status}".`
			});
		}

		const { error: updateError } = await locals.supabase
			.from('orders')
			.update({ status })
			.eq('id', orderId);

		if (updateError) {
			return fail(500, { statusMessage: 'Could not update the order. Please try again.' });
		}

		return { statusMessage: null };
	}
};
