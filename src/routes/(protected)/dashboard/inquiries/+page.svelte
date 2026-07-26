<script lang="ts">
	import { resolve } from '$app/paths';
	import SiteHeader from '$lib/components/site-header.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { travelInquiryStatusVariant } from '$lib/bookings/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<SiteHeader title="Travel Inquiries" />
<div class="@container/main flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
	<div class="flex items-center justify-end gap-2">
		<Button href={resolve('/dashboard/inquiries/new')}>Log inquiry</Button>
	</div>

	<ul class="divide-y divide-border rounded-lg border border-border">
		{#each data.inquiries as inquiry (inquiry.id)}
			<li class="flex items-center justify-between px-4 py-3">
				<div>
					<a
						href={resolve(`/dashboard/inquiries/${inquiry.id}`)}
						class="font-medium hover:underline"
					>
						{inquiry.customerName}
					</a>
					<p class="text-sm text-muted-foreground">{inquiry.tripDescription}</p>
				</div>
				<Badge variant={travelInquiryStatusVariant(inquiry.status)}>{inquiry.status}</Badge>
			</li>
		{:else}
			<li class="px-4 py-6 text-center text-sm text-muted-foreground">No inquiries yet.</li>
		{/each}
	</ul>
</div>
