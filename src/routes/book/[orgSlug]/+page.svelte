<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { formatDateRange } from '$lib/format-date';
	import { formatPriceCents } from '$lib/format-price';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Travel Packages</title>
</svelte:head>

<main class="mx-auto max-w-3xl px-4 py-12">
	<h1 class="mb-8 text-2xl font-semibold">Travel Packages</h1>

	<div class="grid gap-6 sm:grid-cols-2">
		{#each data.resources as resource (resource.id)}
			<a
				href={resolve(`/book/${page.params.orgSlug}/${resource.id}`)}
				class="block rounded-lg border border-border p-4 transition-colors hover:border-foreground/30"
			>
				<div class="mb-3 flex h-32 items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">
					{resource.imageCount} photo{resource.imageCount === 1 ? '' : 's'}
				</div>
				<h2 class="font-medium">{resource.name}</h2>
				<p class="text-sm text-muted-foreground">
					{formatDateRange(resource.departureDate, resource.returnDate)}
				</p>
				<p class="mt-1 font-medium">{formatPriceCents(resource.priceCents)}</p>
			</a>
		{:else}
			<p class="text-sm text-muted-foreground">No packages available right now.</p>
		{/each}
	</div>
</main>
