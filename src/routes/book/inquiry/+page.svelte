<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Field, FieldDescription, FieldGroup, FieldLabel } from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';

	const id = $props.id();

	let name = $state('');
	let email = $state('');
	let phone = $state('');
	let tripDescription = $state('');
	let preferredDates = $state('');
	let partySize = $state('');
	let budget = $state('');
	let notes = $state('');
</script>

<svelte:head>
	<title>Design a Custom Trip</title>
</svelte:head>

<main class="mx-auto max-w-3xl px-4 py-12">
	<h1 class="mb-2 text-2xl font-semibold">Design a Custom Trip</h1>
	<p class="mb-8 text-muted-foreground">
		Don't see a package that fits? Tell us what you have in mind and an agent will follow up.
	</p>

	<!-- TODO(#47): wire real submission once this form is backed by the
	     public server action (org resolved from slug, customer match-or-
	     create by email reusing the booking flow's logic, rate-limited). -->
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
				<FieldLabel for="tripDescription-{id}">Where would you like to go?</FieldLabel>
				<textarea
					id="tripDescription-{id}"
					bind:value={tripDescription}
					rows="3"
					placeholder="Destination, type of trip, anything else that helps us plan."
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
					placeholder="Anything else we should know?"
					class="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
				></textarea>
			</Field>
		</FieldGroup>

		<Field>
			<!-- Disabled, not just prevented — an enabled button that silently
			     no-ops leaves a visitor believing their inquiry was sent when
			     it wasn't. Re-enable once #47 wires a real submission. -->
			<Button type="submit" disabled>Send inquiry</Button>
			<FieldDescription>Submission isn't available yet — please check back soon.</FieldDescription>
		</Field>
	</form>
</main>
