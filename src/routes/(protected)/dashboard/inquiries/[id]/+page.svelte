<script lang="ts">
	import SiteHeader from '$lib/components/site-header.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { travelInquiryStatusVariant } from '$lib/bookings/types';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const id = $props.id();
	const formId = `inquiry-form-${id}`;
</script>

<SiteHeader title="Inquiry" />
<div class="@container/main flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
	<div class="max-w-lg space-y-6">
		{#if form?.success}
			<p class="text-sm font-normal text-green-700" role="status">{form.message}</p>
		{:else if form?.message}
			<p class="text-sm text-destructive" role="alert">{form.message}</p>
		{/if}

		<div class="flex items-center justify-between">
			<h2 class="text-lg font-semibold">{data.inquiry.customerName}</h2>
			<Badge variant={travelInquiryStatusVariant(data.inquiry.status)}>{data.inquiry.status}</Badge>
		</div>

		<dl class="space-y-3 text-sm">
			<div>
				<dt class="text-muted-foreground">Customer</dt>
				<dd>{data.inquiry.customerName} · {data.inquiry.customerEmail ?? 'no email'}</dd>
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

		<form id={formId} method="POST" class="flex gap-2">
			{#if data.inquiry.status === 'new'}
				<Button type="submit" formaction="?/startProgress">Start progress</Button>
				<Button type="submit" variant="outline" formaction="?/convert">Convert</Button>
				<Button type="submit" variant="outline" formaction="?/close">Close</Button>
			{:else if data.inquiry.status === 'in-progress'}
				<Button type="submit" formaction="?/convert">Convert</Button>
				<Button type="submit" variant="outline" formaction="?/close">Close</Button>
			{/if}
		</form>
	</div>
</div>
