<script lang="ts">
	import { Field, FieldGroup, FieldLabel, FieldError } from '$lib/components/ui/field/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import PasswordInput from '$lib/components/PasswordInput.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	const id = $props.id();
</script>

<main class="mx-auto mt-16 max-w-sm">
	<h1 class="mb-6 text-xl font-semibold">Set your password</h1>

	<form method="POST">
		<FieldGroup>
			<Field>
				<FieldLabel for="password-{id}">Password</FieldLabel>
				<PasswordInput
					id="password-{id}"
					name="password"
					autocomplete="new-password"
					minlength={8}
				/>
			</Field>

			{#if form?.message}
				<FieldError errors={[{ message: form.message }]} />
			{/if}

			<Field>
				<Button type="submit">Set password</Button>
			</Field>
		</FieldGroup>
	</form>
</main>
