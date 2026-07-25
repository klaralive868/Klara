<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Field, FieldGroup, FieldLabel } from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { formatDateRange } from '$lib/format-date';
	import { formatPriceCents } from '$lib/format-price';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const id = $props.id();

	let name = $state('');
	let email = $state('');
	let phone = $state('');
	let travelerCount = $state('1');
	let notes = $state('');
</script>

<svelte:head>
	<title>{data.resource.name}</title>
</svelte:head>

<main class="mx-auto max-w-3xl px-4 py-12">
	<div class="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
		{#each Array(data.resource.imageCount) as _, index (index)}
			<div class="flex h-32 items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">
				Photo {index + 1}
			</div>
		{/each}
	</div>

	<h1 class="text-2xl font-semibold">{data.resource.name}</h1>
	<p class="mt-1 text-muted-foreground">
		{formatDateRange(data.resource.departureDate, data.resource.returnDate)}
	</p>
	<p class="mt-2 text-lg font-medium">{formatPriceCents(data.resource.priceCents)}</p>
	<p class="mt-4">{data.resource.description}</p>

	<!-- Deliberately no seat/capacity numbers here — that's agent-only
	     information (docs/bookings-travel-packages-spec.md); capacity is
	     never authoritative enough to display or gate on publicly. Enforced
	     at the load boundary too (toPublicResource strips it from the data
	     payload entirely), not just withheld by this template. -->

	<h2 class="mt-10 mb-4 text-lg font-semibold">Request this package</h2>

	<!-- TODO(#43): wire real submission once this form is backed by the
	     public server action (org resolved from slug, customer match-or-
	     create by email, rate-limited). -->
	<form class="max-w-md space-y-6" onsubmit={(event) => event.preventDefault()}>
		<FieldGroup>
			<Field>
				<FieldLabel for="name-{id}">Full name</FieldLabel>
				<Input id="name-{id}" bind:value={name} required />
			</Field>

			<Field>
				<FieldLabel for="email-{id}">Email</FieldLabel>
				<Input id="email-{id}" type="email" bind:value={email} required />
			</Field>

			<Field>
				<FieldLabel for="phone-{id}">Phone</FieldLabel>
				<Input id="phone-{id}" type="tel" bind:value={phone} />
			</Field>

			<Field>
				<FieldLabel for="travelerCount-{id}">Traveler count</FieldLabel>
				<Input
					id="travelerCount-{id}"
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
					bind:value={notes}
					rows="3"
					placeholder="Other traveler names, special requests, etc."
					class="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
				></textarea>
			</Field>
		</FieldGroup>

		<Field>
			<Button type="submit">Request booking</Button>
		</Field>
	</form>
</main>
