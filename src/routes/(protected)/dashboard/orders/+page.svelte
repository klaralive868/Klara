<script lang="ts">
	import { enhance } from '$app/forms';
	import SiteHeader from '$lib/components/site-header.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { formatPriceCents } from '$lib/format-price';
	import {
		ORDER_STATUS_TRANSITIONS,
		orderItemsSummary,
		orderStatusLabel,
		orderStatusVariant,
		type OrderStatus
	} from '$lib/orders/types';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Orders are still ?/updateStatus'd one at a time — each row's pending
	// state is tracked by order id so submitting one row's form doesn't
	// disable buttons on every other row.
	let pendingOrderId = $state<string | null>(null);

	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function nextStepLabel(status: OrderStatus) {
		if (status === 'confirmed') return 'Confirm';
		if (status === 'out_for_delivery') return 'Out for delivery';
		if (status === 'cancelled') return 'Cancel';
		return orderStatusLabel(status);
	}
</script>

<SiteHeader title="Orders" />
<div class="@container/main flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
	{#if form?.statusMessage}
		<p class="text-sm text-destructive" role="alert">{form.statusMessage}</p>
	{/if}
	<div class="overflow-hidden rounded-lg border">
		<Table.Root>
			<Table.Header class="bg-muted">
				<Table.Row>
					<Table.Head>Status</Table.Head>
					<Table.Head>Customer</Table.Head>
					<Table.Head>Items</Table.Head>
					<Table.Head>Total</Table.Head>
					<Table.Head>Placed</Table.Head>
					<Table.Head class="text-right">Actions</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if data.orders.length > 0}
					{#each data.orders as order (order.id)}
						<Table.Row>
							<Table.Cell>
								<Badge variant={orderStatusVariant(order.status)}
									>{orderStatusLabel(order.status)}</Badge
								>
							</Table.Cell>
							<Table.Cell class="font-medium">
								{order.customerName}
								<p class="text-xs text-muted-foreground">{order.customerEmail ?? 'no email'}</p>
							</Table.Cell>
							<Table.Cell class="max-w-md text-sm text-muted-foreground">
								{orderItemsSummary(order.items)}
							</Table.Cell>
							<Table.Cell>{formatPriceCents(order.totalAmountCents)}</Table.Cell>
							<Table.Cell>{formatDate(order.createdAt)}</Table.Cell>
							<Table.Cell class="text-right">
								<div class="flex justify-end gap-2">
									{#each ORDER_STATUS_TRANSITIONS[order.status] as nextStatus (nextStatus)}
										<form
											method="POST"
											action="?/updateStatus"
											use:enhance={() => {
												pendingOrderId = order.id;
												return async ({ update }) => {
													pendingOrderId = null;
													await update();
												};
											}}
										>
											<input type="hidden" name="orderId" value={order.id} />
											<input type="hidden" name="status" value={nextStatus} />
											<Button
												type="submit"
												size="sm"
												variant={nextStatus === 'cancelled' ? 'outline' : 'default'}
												disabled={pendingOrderId === order.id}
											>
												{nextStepLabel(nextStatus)}
											</Button>
										</form>
									{/each}
								</div>
							</Table.Cell>
						</Table.Row>
					{/each}
				{:else}
					<Table.Row>
						<Table.Cell colspan={6} class="h-24 text-center text-muted-foreground">
							No orders yet.
						</Table.Cell>
					</Table.Row>
				{/if}
			</Table.Body>
		</Table.Root>
	</div>
</div>
