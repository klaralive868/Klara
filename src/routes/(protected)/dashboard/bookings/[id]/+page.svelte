<script lang="ts">
	import SiteHeader from '$lib/components/site-header.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { formatDateRange } from '$lib/format-date';
	import { bookingStatusVariant } from '$lib/bookings/types';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const id = $props.id();
	const formId = `booking-form-${id}`;
</script>

<SiteHeader title="Booking" />
<div class="@container/main flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
	<div class="max-w-lg space-y-6">
		{#if form?.success}
			<p class="text-sm font-normal text-green-700" role="status">{form.message}</p>
		{:else if form?.message}
			<p class="text-sm text-destructive" role="alert">{form.message}</p>
		{/if}

		<div class="flex items-center justify-between">
			<h2 class="text-lg font-semibold">{data.booking.customerName}</h2>
			<Badge variant={bookingStatusVariant(data.booking.status)}>{data.booking.status}</Badge>
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
				<dd>{data.booking.customerName} · {data.booking.customerEmail ?? 'no email'}</dd>
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

		<form id={formId} method="POST" class="flex gap-2">
			{#if data.booking.status === 'pending'}
				<Button type="submit" formaction="?/confirm">Confirm</Button>
				<Button type="submit" variant="outline" formaction="?/cancel">Cancel</Button>
			{:else if data.booking.status === 'confirmed'}
				<Button type="submit" formaction="?/complete">Mark completed</Button>
				<Button type="submit" variant="outline" formaction="?/cancel">Cancel</Button>
			{/if}
		</form>
	</div>
</div>
