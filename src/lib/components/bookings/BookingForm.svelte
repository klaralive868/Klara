<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Field, FieldGroup, FieldLabel, FieldDescription, FieldError } from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import CustomerPicker from './CustomerPicker.svelte';
	import { formatDateRange } from '$lib/format-date';
	import type { Resource } from '$lib/bookings/types';
	import type { Customer } from '$lib/customers/types';

	let {
		resources,
		customers,
		message
	}: { resources: Resource[]; customers: Customer[]; message?: string } = $props();

	const id = $props.id();

	let customer = $state<Customer | null>(null);
	let resourceId = $state('');
	let travelerCount = $state('1');
	let notes = $state('');

	// The departure/return dates come from the selected resource, not chosen
	// independently by whoever's logging the booking — same rule as the
	// public submission path (docs/bookings-travel-packages-spec.md). The
	// server re-derives this itself from resourceId; the dates aren't
	// actually submitted, this is display-only.
	const selectedResource = $derived(resources.find((resource) => resource.id === resourceId));
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
			<FieldLabel for="resource-{id}">Package</FieldLabel>
			<select
				id="resource-{id}"
				name="resourceId"
				bind:value={resourceId}
				required
				class="h-9 w-full rounded-3xl border border-input bg-transparent px-3 text-sm"
			>
				<option value="">Select a package…</option>
				{#each resources as resource (resource.id)}
					<option value={resource.id}>{resource.name}</option>
				{/each}
			</select>
			{#if selectedResource}
				<FieldDescription>
					{formatDateRange(selectedResource.departureDate, selectedResource.returnDate)}
				</FieldDescription>
			{/if}
		</Field>

		<Field>
			<FieldLabel for="travelerCount-{id}">Traveler count</FieldLabel>
			<Input
				id="travelerCount-{id}"
				name="travelerCount"
				type="number"
				min="1"
				step="1"
				bind:value={travelerCount}
				required
				class="max-w-32"
			/>
		</Field>

		<Field>
			<FieldLabel for="notes-{id}">Notes</FieldLabel>
			<textarea
				id="notes-{id}"
				name="notes"
				bind:value={notes}
				rows="3"
				placeholder="Other traveler names, special requests, etc."
				class="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
			></textarea>
		</Field>
	</FieldGroup>

	<Field>
		<Button type="submit" disabled={!customer || !resourceId}>Log booking</Button>
	</Field>
</form>
