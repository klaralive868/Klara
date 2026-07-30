<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Field, FieldGroup, FieldLabel } from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { formatDateRange } from '$lib/format-date';
	import { formatPriceCents } from '$lib/format-price';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const id = $props.id();

	let submitting = $state(false);
</script>

<svelte:head>
	<title>{data.resource.name}</title>
</svelte:head>

<main class="mx-auto max-w-3xl px-4 py-12">
	{#if data.resource.images.length > 0}
		<div class="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
			{#each data.resource.images as image (image.id)}
				<img src={image.url} alt={data.resource.name} class="h-32 w-full rounded-md object-cover" />
			{/each}
		</div>
	{/if}

	<h1 class="text-2xl font-semibold">{data.resource.name}</h1>
	<p class="mt-1 text-muted-foreground">
		{formatDateRange(data.resource.departureDate, data.resource.returnDate)}
	</p>
	<p class="mt-2 text-lg font-medium">{formatPriceCents(data.resource.priceCents)}</p>
	<p class="mt-4">{data.resource.description}</p>

	<!-- Deliberately no seat/capacity numbers here — that's agent-only
	     information (docs/bookings-travel-packages-spec.md); capacity is
	     never authoritative enough to display or gate on publicly. Enforced
	     at the load boundary too (getPublishedResource strips it from the
	     data payload entirely), not just withheld by this template. -->

	<h2 class="mt-10 mb-4 text-lg font-semibold">Request this package</h2>

	{#if form?.success}
		<p class="max-w-md rounded-lg border border-border bg-muted p-4 text-sm">
			Thanks! Your request has been sent — we'll be in touch shortly.
		</p>
	{:else}
		<form
			method="POST"
			class="max-w-md space-y-6"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update();
					submitting = false;
				};
			}}
		>
			{#if form?.message}
				<p class="text-sm text-destructive">{form.message}</p>
			{/if}

			<FieldGroup>
				<Field>
					<FieldLabel for="name-{id}">Full name</FieldLabel>
					<Input id="name-{id}" name="name" required />
				</Field>

				<Field>
					<FieldLabel for="email-{id}">Email</FieldLabel>
					<Input id="email-{id}" name="email" type="email" required />
				</Field>

				<Field>
					<FieldLabel for="phone-{id}">Phone</FieldLabel>
					<Input id="phone-{id}" name="phone" type="tel" />
				</Field>

				<Field>
					<FieldLabel for="travelerCount-{id}">Traveler count</FieldLabel>
					<Input
						id="travelerCount-{id}"
						name="travelerCount"
						type="number"
						min="1"
						step="1"
						value="1"
						required
						class="max-w-32"
					/>
				</Field>

				<Field>
					<FieldLabel for="notes-{id}">Notes</FieldLabel>
					<textarea
						id="notes-{id}"
						name="notes"
						rows="3"
						placeholder="Other traveler names, special requests, etc."
						class="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
					></textarea>
				</Field>
			</FieldGroup>

			<Field>
				<Button type="submit" disabled={submitting}>Request booking</Button>
			</Field>
		</form>
	{/if}
</main>
