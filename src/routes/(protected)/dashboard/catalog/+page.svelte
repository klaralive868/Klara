<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button/index.js';
	import { getMaterialType } from '$lib/catalog/material-types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function formatPrice(cents: number) {
		return `$${(cents / 100).toFixed(2)}`;
	}
</script>

<main class="mx-auto mt-16 max-w-2xl">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-xl font-semibold">Catalog</h1>
		<div class="flex gap-2">
			<Button href={resolve('/dashboard/catalog/categories')} variant="outline">Categories</Button>
			<Button href={resolve('/dashboard/catalog/new')}>Add item</Button>
		</div>
	</div>

	<ul class="divide-y divide-border rounded-lg border border-border">
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
</main>
