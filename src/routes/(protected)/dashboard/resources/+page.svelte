<script lang="ts">
	import { resolve } from '$app/paths';
	import SiteHeader from '$lib/components/site-header.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { ResourceStatus } from '$lib/bookings/placeholder-resources';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function formatPrice(cents: number) {
		return `$${(cents / 100).toFixed(2)}`;
	}

	const MONTH_NAMES = [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec'
	];

	// Deliberately not `new Date(iso).toLocaleDateString(...)` — that parses
	// the plain "YYYY-MM-DD" as UTC midnight, then renders in the browser's
	// local timezone, which shifts the displayed date back a day for anyone
	// west of UTC. A departure date is a calendar date, not an instant — read
	// the parts directly instead of going through any timezone conversion.
	function formatDateRange(departureDate: string, returnDate: string) {
		const format = (iso: string) => {
			const [, month, day] = iso.split('-');
			return `${MONTH_NAMES[Number(month) - 1]} ${Number(day)}`;
		};
		return `${format(departureDate)} – ${format(returnDate)}`;
	}

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
						{formatDateRange(resource.departureDate, resource.returnDate)} · {formatPrice(
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
