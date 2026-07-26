<script lang="ts">
	import { untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Field, FieldGroup, FieldLabel, FieldError } from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import CustomerPicker from './CustomerPicker.svelte';
	import type { Customer } from '$lib/customers/types';

	interface SubmittedValues {
		customerId: string;
		tripDescription: string;
		preferredDates: string;
		partySize: string;
		budget: string;
		notes: string;
	}

	let {
		customers,
		message,
		values
	}: { customers: Customer[]; message?: string; values?: SubmittedValues } = $props();

	const id = $props.id();

	// A plain method="POST" submission is a full page navigation — nothing
	// here survives a failed attempt on its own. `values` (the action's
	// echoed-back submission) re-seeds these on the re-render that follows a
	// fail(), same "capture once, don't chase the prop afterwards"
	// convention as ResourceForm/CustomerForm's `initial`.
	let customer = $state<Customer | null>(
		untrack(() => customers.find((c) => c.id === values?.customerId) ?? null)
	);
	let tripDescription = $state(untrack(() => values?.tripDescription ?? ''));
	let preferredDates = $state(untrack(() => values?.preferredDates ?? ''));
	let partySize = $state(untrack(() => values?.partySize ?? ''));
	let budget = $state(untrack(() => values?.budget ?? ''));
	let notes = $state(untrack(() => values?.notes ?? ''));
</script>

<form method="POST" class="space-y-6">
	{#if message}
		<FieldError errors={[{ message }]} />
	{/if}

	<Field>
		<FieldLabel>Customer</FieldLabel>
		<CustomerPicker {customers} bind:selected={customer} />
		<input type="hidden" name="customerId" value={customer?.id ?? ''} />
	</Field>

	<FieldGroup>
		<Field>
			<FieldLabel for="tripDescription-{id}">Trip description</FieldLabel>
			<textarea
				id="tripDescription-{id}"
				name="tripDescription"
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
				name="preferredDates"
				bind:value={preferredDates}
				placeholder="e.g. Sometime in September 2026, 10-12 days"
			/>
		</Field>

		<Field>
			<FieldLabel for="partySize-{id}">Party size</FieldLabel>
			<Input
				id="partySize-{id}"
				name="partySize"
				type="number"
				min="1"
				step="1"
				bind:value={partySize}
				class="max-w-32"
			/>
		</Field>

		<Field>
			<FieldLabel for="budget-{id}">Budget</FieldLabel>
			<Input id="budget-{id}" name="budget" bind:value={budget} placeholder="e.g. $8,000–$10,000" />
		</Field>

		<Field>
			<FieldLabel for="notes-{id}">Notes</FieldLabel>
			<textarea
				id="notes-{id}"
				name="notes"
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
