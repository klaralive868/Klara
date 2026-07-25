<script lang="ts">
	import { untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Field, FieldGroup, FieldLabel, FieldDescription } from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import type { PlaceholderResource } from '$lib/bookings/placeholder-resources';

	let { initial }: { initial?: PlaceholderResource } = $props();

	const id = $props.id();

	// Each of these deliberately captures `initial` only once, to seed
	// editable local state — not to stay in sync with the prop afterwards
	// (same convention as CatalogItemForm/CustomerForm).
	let name = $state(untrack(() => initial?.name ?? ''));
	let description = $state(untrack(() => initial?.description ?? ''));
	let departureDate = $state(untrack(() => initial?.departureDate ?? ''));
	let returnDate = $state(untrack(() => initial?.returnDate ?? ''));
	let price = $state(untrack(() => (initial ? (initial.priceCents / 100).toFixed(2) : '')));
	let requiresManualConfirmation = $state(untrack(() => initial?.requiresManualConfirmation ?? true));

	// Capacity is optional — "uncapped" is a first-class, clearly-labelled
	// state (Standards §4: a package with no hard limit is never auto-
	// rejected for being "full"), not just an empty/zero number field.
	let hasCapacity = $state(untrack(() => (initial?.quantity ?? null) !== null));
	let quantity = $state(untrack(() => (initial?.quantity != null ? String(initial.quantity) : '')));
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
				class="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
			></textarea>
		</Field>

		<Field>
			<FieldLabel for="departureDate-{id}">Departure date</FieldLabel>
			<Input id="departureDate-{id}" type="date" bind:value={departureDate} required />
		</Field>

		<Field>
			<FieldLabel for="returnDate-{id}">Return date</FieldLabel>
			<Input id="returnDate-{id}" type="date" bind:value={returnDate} required />
		</Field>

		<Field>
			<FieldLabel for="price-{id}">Price (USD)</FieldLabel>
			<Input id="price-{id}" type="number" min="0" step="0.01" bind:value={price} required />
		</Field>
	</FieldGroup>

	<Field>
		<div class="flex items-center gap-2">
			<Checkbox id="hasCapacity-{id}" bind:checked={hasCapacity} />
			<FieldLabel for="hasCapacity-{id}">Set a seat limit</FieldLabel>
		</div>
		<FieldDescription>
			Leave unchecked for no limit — requests are always logged, never auto-rejected for being
			"full".
		</FieldDescription>
		{#if hasCapacity}
			<Input
				id="quantity-{id}"
				type="number"
				min="0"
				step="1"
				bind:value={quantity}
				class="mt-2 max-w-32"
			/>
		{/if}
	</Field>

	<Field>
		<div class="flex items-center gap-2">
			<Checkbox id="requiresManualConfirmation-{id}" bind:checked={requiresManualConfirmation} />
			<FieldLabel for="requiresManualConfirmation-{id}">Requires manual confirmation</FieldLabel>
		</div>
		<FieldDescription>
			Every request starts pending regardless — this only controls whether there's ever a
			fast-path to auto-confirm.
		</FieldDescription>
	</Field>

	<Field>
		<Button type="submit">{initial ? 'Save resource' : 'Add resource'}</Button>
	</Field>
</form>
