<script lang="ts">
	import SiteHeader from '$lib/components/site-header.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { formatPriceCents } from '$lib/format-price';
	import { orderItemsSummary, orderStatusVariant } from '$lib/orders/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<SiteHeader title="Orders" />
<div class="@container/main flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
	<div class="overflow-hidden rounded-lg border">
		<Table.Root>
			<Table.Header class="bg-muted">
				<Table.Row>
					<Table.Head>Status</Table.Head>
					<Table.Head>Customer</Table.Head>
					<Table.Head>Items</Table.Head>
					<Table.Head>Total</Table.Head>
					<Table.Head>Placed</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if data.orders.length > 0}
					{#each data.orders as order (order.id)}
						<Table.Row>
							<Table.Cell>
								<Badge variant={orderStatusVariant(order.status)}>{order.status}</Badge>
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
						</Table.Row>
					{/each}
				{:else}
					<Table.Row>
						<Table.Cell colspan={5} class="h-24 text-center text-muted-foreground">
							No orders yet.
						</Table.Cell>
					</Table.Row>
				{/if}
			</Table.Body>
		</Table.Root>
	</div>
</div>
