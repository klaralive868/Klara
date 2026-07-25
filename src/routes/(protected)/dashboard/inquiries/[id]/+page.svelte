<script lang="ts">
	import { untrack } from 'svelte';
	import SiteHeader from '$lib/components/site-header.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import {
		travelInquiryStatusVariant,
		type TravelInquiryStatus
	} from '$lib/bookings/placeholder-inquiries';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const id = $props.id();

	const STATUS_OPTIONS: TravelInquiryStatus[] = ['new', 'in-progress', 'converted', 'closed'];

	// Locally mutable so the status control below has something to
	// demonstrate — this is placeholder-only, nothing persists past a
	// reload yet (#48 wires the real update).
	let status = $state<TravelInquiryStatus>(untrack(() => data.inquiry.status));

	// SvelteKit reuses this component instance across client-side
	// navigation between different inquiry ids (only the route param
	// changes) — resync whenever a fresh `data` arrives, same fix as the
	// booking detail page (#41's review).
	$effect(() => {
		status = data.inquiry.status;
	});
</script>

<SiteHeader title="Inquiry" />
<div class="@container/main flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
	<div class="max-w-lg space-y-6">
		<div class="flex items-center justify-between">
			<h2 class="text-lg font-semibold">{data.inquiry.customerName}</h2>
			<Badge variant={travelInquiryStatusVariant(status)}>{status}</Badge>
		</div>

		<dl class="space-y-3 text-sm">
			<div>
				<dt class="text-muted-foreground">Customer</dt>
				<dd>{data.inquiry.customerName} · {data.inquiry.customerEmail}</dd>
			</div>
			<div>
				<dt class="text-muted-foreground">Trip description</dt>
				<dd>{data.inquiry.tripDescription}</dd>
			</div>
			<div>
				<dt class="text-muted-foreground">Preferred dates</dt>
				<dd>{data.inquiry.preferredDates || '—'}</dd>
			</div>
			<div>
				<dt class="text-muted-foreground">Party size</dt>
				<dd>{data.inquiry.partySize ?? '—'}</dd>
			</div>
			<div>
				<dt class="text-muted-foreground">Budget</dt>
				<dd>{data.inquiry.budget || '—'}</dd>
			</div>
			<div>
				<dt class="text-muted-foreground">Notes</dt>
				<dd>{data.inquiry.notes || '—'}</dd>
			</div>
		</dl>

		<div>
			<label for="status-{id}" class="mb-2 block text-sm font-medium">Status</label>
			<select
				id="status-{id}"
				bind:value={status}
				class="h-9 w-full max-w-48 rounded-3xl border border-input bg-transparent px-3 text-sm capitalize"
			>
				{#each STATUS_OPTIONS as option (option)}
					<option value={option}>{option}</option>
				{/each}
			</select>
		</div>
	</div>
</div>
