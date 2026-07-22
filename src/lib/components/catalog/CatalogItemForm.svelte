<script lang="ts">
	import { untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Field, FieldGroup, FieldLabel, FieldError } from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import MaterialTypePicker from './MaterialTypePicker.svelte';
	import StockSelector from './StockSelector.svelte';
	import CategoryTagger from './CategoryTagger.svelte';
	import ImageUploader from './ImageUploader.svelte';
	import { getMaterialType } from '$lib/catalog/material-types';
	import type { CatalogCategory, CatalogItem } from '$lib/catalog/types';

	let {
		initial,
		initialCategoryIds = [],
		initialStockQuantities = {},
		categories,
		message
	}: {
		initial?: CatalogItem;
		initialCategoryIds?: string[];
		initialStockQuantities?: Record<string, number>;
		categories: readonly CatalogCategory[];
		message?: string;
	} = $props();

	const id = $props.id();

	// Each of these deliberately captures `initial` only once, to seed
	// editable local state — not to stay in sync with the prop afterwards.
	let name = $state(untrack(() => initial?.name ?? ''));
	let description = $state(untrack(() => initial?.description ?? ''));
	let price = $state(untrack(() => (initial ? (initial.priceCents / 100).toFixed(2) : '')));
	let materialType = $state(untrack(() => initial?.materialType ?? ''));
	let stockQuantities = $state<Record<string, number>>(
		untrack(() => ({ ...initialStockQuantities }))
	);
	let categoryIds = $state<string[]>(untrack(() => [...initialCategoryIds]));

	const selectedType = $derived(materialType ? getMaterialType(materialType) : undefined);

	// Reset stock quantities whenever the material type (and therefore its
	// sizing scheme) changes, so stale sizes from a previous selection can't
	// linger.
	let lastMaterialType = untrack(() => initial?.materialType ?? '');
	$effect(() => {
		if (materialType !== lastMaterialType) {
			stockQuantities = {};
			lastMaterialType = materialType;
		}
	});
</script>

<form method="POST" class="space-y-6">
	<FieldGroup>
		<Field>
			<FieldLabel for="name-{id}">Name</FieldLabel>
			<Input id="name-{id}" name="name" bind:value={name} required />
		</Field>

		<Field>
			<FieldLabel for="description-{id}">Description</FieldLabel>
			<textarea
				id="description-{id}"
				name="description"
				bind:value={description}
				rows="3"
				class="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"></textarea>
		</Field>

		<Field>
			<FieldLabel for="price-{id}">Price (USD)</FieldLabel>
			<Input
				id="price-{id}"
				name="price"
				type="number"
				min="0"
				step="0.01"
				bind:value={price}
				required
			/>
		</Field>
	</FieldGroup>

	<div>
		<p class="mb-2 text-sm font-medium">Material type</p>
		<input type="hidden" name="materialType" value={materialType} />
		<MaterialTypePicker bind:value={materialType} />
	</div>

	{#if selectedType}
		<div>
			<p class="mb-2 text-sm font-medium">Stock</p>
			<input type="hidden" name="stockQuantities" value={JSON.stringify(stockQuantities)} />
			<StockSelector sizingScheme={selectedType.sizingScheme} bind:quantities={stockQuantities} />
		</div>
	{/if}

	<div>
		<p class="mb-2 text-sm font-medium">Categories</p>
		<CategoryTagger {categories} bind:selected={categoryIds} />
	</div>

	<ImageUploader />

	{#if message}
		<FieldError errors={[{ message }]} />
	{/if}

	{#if initial}
		<div>
			<p class="mb-2 text-sm font-medium">
				Status: <span class="font-normal capitalize">{initial.status}</span>
			</p>
			<div class="flex flex-wrap items-center gap-2">
				{#if initial.status === 'draft'}
					<Button type="submit" formaction="?/publish">Publish</Button>
					<Button type="submit" formaction="?/archive" variant="outline">Archive</Button>
				{:else if initial.status === 'published'}
					<Button type="submit" formaction="?/archive" variant="outline">Archive</Button>
				{:else if initial.status === 'archived'}
					<Button type="submit" formaction="?/unarchive" variant="outline">Unarchive</Button>
				{/if}
			</div>
		</div>
	{/if}

	<Field>
		<Button type="submit" formaction={initial ? '?/update' : undefined}>Save item</Button>
	</Field>
</form>
