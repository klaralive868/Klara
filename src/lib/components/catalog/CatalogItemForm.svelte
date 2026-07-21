<script lang="ts">
	import { untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Field, FieldGroup, FieldLabel } from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import MaterialTypePicker from './MaterialTypePicker.svelte';
	import SizeSelector from './SizeSelector.svelte';
	import { getMaterialType } from '$lib/catalog/material-types';
	import type { CatalogItemStatus, PlaceholderCatalogItem } from '$lib/catalog/placeholder-items';

	let { initial }: { initial?: PlaceholderCatalogItem } = $props();

	const id = $props.id();

	// Each of these deliberately captures `initial` only once, to seed
	// editable local state — not to stay in sync with the prop afterwards.
	let name = $state(untrack(() => initial?.name ?? ''));
	let description = $state(untrack(() => initial?.description ?? ''));
	let price = $state(untrack(() => (initial ? (initial.priceCents / 100).toFixed(2) : '')));
	let materialType = $state(untrack(() => initial?.materialType ?? ''));
	let sizes = $state<string[]>(untrack(() => initial?.sizes ?? []));
	let status = $state<CatalogItemStatus>(untrack(() => initial?.status ?? 'draft'));

	const selectedType = $derived(materialType ? getMaterialType(materialType) : undefined);

	// Reset sizes whenever the material type (and therefore its sizing scheme)
	// changes, so stale sizes from a previous selection can't linger.
	let lastMaterialType = untrack(() => initial?.materialType ?? '');
	$effect(() => {
		if (materialType !== lastMaterialType) {
			sizes = [];
			lastMaterialType = materialType;
		}
	});
</script>

<form class="space-y-6">
	<FieldGroup>
		<Field>
			<FieldLabel for="name-{id}">Name</FieldLabel>
			<Input id="name-{id}" bind:value={name} required />
		</Field>

		<Field>
			<FieldLabel for="description-{id}">Description</FieldLabel>
			<textarea
				id="description-{id}"
				bind:value={description}
				rows="3"
				class="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"></textarea>
		</Field>

		<Field>
			<FieldLabel for="price-{id}">Price (USD)</FieldLabel>
			<Input id="price-{id}" type="number" min="0" step="0.01" bind:value={price} required />
		</Field>
	</FieldGroup>

	<div>
		<p class="mb-2 text-sm font-medium">Material type</p>
		<MaterialTypePicker bind:value={materialType} />
	</div>

	{#if selectedType}
		<div>
			<p class="mb-2 text-sm font-medium">Sizes</p>
			<SizeSelector sizingScheme={selectedType.sizingScheme} bind:selected={sizes} />
		</div>
	{/if}

	<div>
		<p class="mb-2 text-sm font-medium">
			Status: <span class="font-normal capitalize">{status}</span>
		</p>
		<div class="flex gap-2">
			{#if status === 'draft'}
				<Button type="button" onclick={() => (status = 'published')}>Publish</Button>
				<Button type="button" variant="outline" onclick={() => (status = 'archived')}>
					Archive
				</Button>
			{:else if status === 'published'}
				<Button type="button" variant="outline" onclick={() => (status = 'archived')}>
					Archive
				</Button>
			{:else if status === 'archived'}
				<Button type="button" variant="outline" onclick={() => (status = 'draft')}>
					Unarchive
				</Button>
			{/if}
		</div>
	</div>

	<Field>
		<Button type="submit">Save item</Button>
	</Field>
</form>
