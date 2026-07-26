<script lang="ts">
	import { resolve } from '$app/paths';
	import SiteHeader from '$lib/components/site-header.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { formatDateRange } from '$lib/format-date';
	import { bookingStatusVariant } from '$lib/bookings/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<SiteHeader title="Bookings" />
<div class="@container/main flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
	<div class="flex items-center justify-end gap-2">
		<Button href={resolve('/dashboard/bookings/new')}>Log booking</Button>
	</div>

	<ul class="divide-y divide-border rounded-lg border border-border">
		{#each data.bookings as booking (booking.id)}
			<li class="flex items-center justify-between px-4 py-3">
				<div>
					<a
						href={resolve(`/dashboard/bookings/${booking.id}`)}
						class="font-medium hover:underline"
					>
						{booking.customerName}
					</a>
					<p class="text-sm text-muted-foreground">
						{booking.resourceName} · {formatDateRange(booking.departureDate, booking.returnDate)} ·
						{booking.travelerCount}
						{booking.travelerCount === 1 ? 'traveler' : 'travelers'}
					</p>
				</div>
				<Badge variant={bookingStatusVariant(booking.status)}>{booking.status}</Badge>
			</li>
		{:else}
			<li class="px-4 py-6 text-center text-sm text-muted-foreground">No bookings yet.</li>
		{/each}
	</ul>
</div>
