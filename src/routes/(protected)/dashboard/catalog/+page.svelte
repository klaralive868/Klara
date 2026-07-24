<script lang="ts">
	import { resolve } from '$app/paths';
	import SiteHeader from '$lib/components/site-header.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { getMaterialType } from '$lib/catalog/material-types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function formatPrice(cents: number) {
		return `$${(cents / 100).toFixed(2)}`;
	}
</script>

<SiteHeader title="Catalog" />
<div class="@container/main flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
	<div class="flex items-center justify-end gap-2">
		<Button href={resolve('/dashboard/catalog/categories')} variant="outline">Categories</Button>
		<Button href={resolve('/dashboard/catalog/new')}>Add item</Button>
	</div>

	<ul class="divide-y divide-border overflow-hidden rounded-lg border border-border">
		{#each data.items as item (item.id)}
			<li class="flex items-center justify-between px-4 py-3">
				<div>
					<a
						href={resolve(`/dashboard/catalog/${item.id}/edit`)}
						class="font-medium hover:underline"
					>
						{item.name}
					</a>
					<p class="text-sm text-muted-foreground">
						{getMaterialType(item.materialType)?.label ?? item.materialType} · {formatPrice(
							item.priceCents
						)}
					</p>
				</div>
				<span class="rounded-3xl border border-input px-3 py-1 text-xs capitalize">
					{item.status}
				</span>
			</li>
		{:else}
			<li class="px-4 py-6 text-center text-sm text-muted-foreground">No items yet.</li>
		{/each}
	</ul>
</div>
