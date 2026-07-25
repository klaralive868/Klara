<script lang="ts">
	import { untrack } from 'svelte';
	import SiteHeader from '$lib/components/site-header.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { formatDateRange } from '$lib/format-date';
	import { bookingStatusVariant, type BookingStatus } from '$lib/bookings/placeholder-bookings';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Seeded once from the loaded booking, then locally mutable so the
	// confirm/cancel/complete buttons below have something to demonstrate —
	// this is placeholder-only, nothing persists past a reload yet (#44
	// wires the real transitions).
	let status = $state<BookingStatus>(untrack(() => data.booking.status));
</script>

<SiteHeader title="Booking" />
<div class="@container/main flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
	<div class="max-w-lg space-y-6">
		<div class="flex items-center justify-between">
			<h2 class="text-lg font-semibold">{data.booking.customerName}</h2>
			<Badge variant={bookingStatusVariant(status)}>{status}</Badge>
		</div>

		<dl class="space-y-3 text-sm">
			<div>
				<dt class="text-muted-foreground">Package</dt>
				<dd class="font-medium">{data.booking.resourceName}</dd>
			</div>
			<div>
				<dt class="text-muted-foreground">Dates</dt>
				<dd>{formatDateRange(data.booking.departureDate, data.booking.returnDate)}</dd>
			</div>
			<div>
				<dt class="text-muted-foreground">Customer</dt>
				<dd>{data.booking.customerName} · {data.booking.customerEmail}</dd>
			</div>
			<div>
				<dt class="text-muted-foreground">Traveler count</dt>
				<dd>{data.booking.travelerCount}</dd>
			</div>
			<div>
				<dt class="text-muted-foreground">Notes</dt>
				<dd>{data.booking.notes || '—'}</dd>
			</div>
		</dl>

		<div class="flex gap-2">
			{#if status === 'pending'}
				<Button type="button" onclick={() => (status = 'confirmed')}>Confirm</Button>
				<Button type="button" variant="outline" onclick={() => (status = 'cancelled')}>
					Cancel
				</Button>
			{:else if status === 'confirmed'}
				<Button type="button" onclick={() => (status = 'completed')}>Mark completed</Button>
				<Button type="button" variant="outline" onclick={() => (status = 'cancelled')}>
					Cancel
				</Button>
			{/if}
		</div>
	</div>
</div>
