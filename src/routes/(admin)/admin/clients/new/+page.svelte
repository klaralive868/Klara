<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Field, FieldGroup, FieldLabel, FieldError } from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	const id = $props.id();
</script>

<main class="mx-auto mt-16 max-w-lg px-4">
	<h1 class="mb-6 text-xl font-semibold">Create client</h1>

	<form method="POST" class="space-y-6">
		<FieldGroup>
			<Field>
				<FieldLabel for="businessName-{id}">Business name</FieldLabel>
				<Input id="businessName-{id}" name="businessName" required />
			</Field>

			<Field>
				<FieldLabel for="ownerFullName-{id}">Owner full name</FieldLabel>
				<Input id="ownerFullName-{id}" name="ownerFullName" required />
			</Field>

			<Field>
				<FieldLabel for="ownerEmail-{id}">Owner email</FieldLabel>
				<Input id="ownerEmail-{id}" name="ownerEmail" type="email" required />
			</Field>
		</FieldGroup>

		{#if form?.message}
			<FieldError errors={[{ message: form.message }]} />
		{/if}

		<Field>
			<Button type="submit">Create client</Button>
		</Field>
	</form>
</main>
