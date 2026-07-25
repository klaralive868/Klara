<script lang="ts">
	import { resolve } from '$app/paths';
	import SiteHeader from '$lib/components/site-header.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { formatDateRange } from '$lib/format-date';
	import { formatPriceCents } from '$lib/format-price';
	import type { ResourceStatus } from '$lib/bookings/placeholder-resources';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function statusVariant(status: ResourceStatus) {
		if (status === 'published') return 'default';
		if (status === 'archived') return 'destructive';
		return 'outline';
	}
</script>

<SiteHeader title="Resources" />
<div class="@container/main flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
	<div class="flex items-center justify-end gap-2">
		<Button href={resolve('/dashboard/resources/new')}>Add resource</Button>
	</div>

	<ul class="divide-y divide-border rounded-lg border border-border">
		{#each data.resources as resource (resource.id)}
			<li class="flex items-center justify-between px-4 py-3">
				<div>
					<a
						href={resolve(`/dashboard/resources/${resource.id}/edit`)}
						class="font-medium hover:underline"
					>
						{resource.name}
					</a>
					<p class="text-sm text-muted-foreground">
						{formatDateRange(resource.departureDate, resource.returnDate)} · {formatPriceCents(
							resource.priceCents
						)} · {resource.quantity === null ? 'No seat limit' : `${resource.quantity} seats`}
					</p>
				</div>
				<Badge variant={statusVariant(resource.status)}>{resource.status}</Badge>
			</li>
		{:else}
			<li class="px-4 py-6 text-center text-sm text-muted-foreground">No resources yet.</li>
		{/each}
	</ul>
</div>
