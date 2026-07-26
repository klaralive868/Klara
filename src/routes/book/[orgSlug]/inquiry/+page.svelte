<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Field, FieldGroup, FieldLabel } from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	const id = $props.id();

	let submitting = $state(false);
</script>

<svelte:head>
	<title>Design a Custom Trip</title>
</svelte:head>

<main class="mx-auto max-w-3xl px-4 py-12">
	<h1 class="mb-2 text-2xl font-semibold">Design a Custom Trip</h1>
	<p class="mb-8 text-muted-foreground">
		Don't see a package that fits? Tell us what you have in mind and an agent will follow up.
	</p>

	{#if form?.success}
		<p class="max-w-md rounded-lg border border-border bg-muted p-4 text-sm">
			Thanks! Your inquiry has been sent — we'll be in touch shortly.
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
					<FieldLabel for="tripDescription-{id}">Where would you like to go?</FieldLabel>
					<textarea
						id="tripDescription-{id}"
						name="tripDescription"
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
						name="preferredDates"
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
						class="max-w-32"
					/>
				</Field>

				<Field>
					<FieldLabel for="budget-{id}">Budget</FieldLabel>
					<Input id="budget-{id}" name="budget" placeholder="e.g. $8,000–$10,000" />
				</Field>

				<Field>
					<FieldLabel for="notes-{id}">Notes</FieldLabel>
					<textarea
						id="notes-{id}"
						name="notes"
						rows="3"
						placeholder="Anything else we should know?"
						class="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
					></textarea>
				</Field>
			</FieldGroup>

			<Field>
				<Button type="submit" disabled={submitting}>Send inquiry</Button>
			</Field>
		</form>
	{/if}
</main>
