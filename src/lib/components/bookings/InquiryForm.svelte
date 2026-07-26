<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Field, FieldGroup, FieldLabel } from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import CustomerPicker from './CustomerPicker.svelte';
	import type { Customer } from '$lib/customers/types';

	let { customers }: { customers: Customer[] } = $props();

	const id = $props.id();

	let customer = $state<Customer | null>(null);
	let tripDescription = $state('');
	let preferredDates = $state('');
	let partySize = $state('');
	let budget = $state('');
	let notes = $state('');
</script>

<!-- TODO(#48): wire real submit once this form is backed by Supabase. -->
<form class="space-y-6" onsubmit={(event) => event.preventDefault()}>
	<Field>
		<FieldLabel>Customer</FieldLabel>
		<CustomerPicker {customers} bind:selected={customer} />
	</Field>

	<FieldGroup>
		<Field>
			<FieldLabel for="tripDescription-{id}">Trip description</FieldLabel>
			<textarea
				id="tripDescription-{id}"
				bind:value={tripDescription}
				rows="3"
				placeholder="Where they want to go, what kind of trip, etc."
				class="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
				required
			></textarea>
		</Field>

		<Field>
			<FieldLabel for="preferredDates-{id}">Preferred dates</FieldLabel>
			<Input
				id="preferredDates-{id}"
				bind:value={preferredDates}
				placeholder="e.g. Sometime in September 2026, 10-12 days"
			/>
		</Field>

		<Field>
			<FieldLabel for="partySize-{id}">Party size</FieldLabel>
			<Input
				id="partySize-{id}"
				type="number"
				min="1"
				step="1"
				bind:value={partySize}
				class="max-w-32"
			/>
		</Field>

		<Field>
			<FieldLabel for="budget-{id}">Budget</FieldLabel>
			<Input id="budget-{id}" bind:value={budget} placeholder="e.g. $8,000–$10,000" />
		</Field>

		<Field>
			<FieldLabel for="notes-{id}">Notes</FieldLabel>
			<textarea
				id="notes-{id}"
				bind:value={notes}
				rows="3"
				class="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
			></textarea>
		</Field>
	</FieldGroup>

	<Field>
		<Button type="submit" disabled={!customer}>Log inquiry</Button>
	</Field>
</form>
