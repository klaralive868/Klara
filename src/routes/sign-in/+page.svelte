<script lang="ts">
	import { Field, FieldGroup, FieldLabel, FieldError } from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import PasswordInput from '$lib/components/PasswordInput.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const id = $props.id();
</script>

<main class="mx-auto mt-16 max-w-sm px-4">
	<h1 class="mb-6 text-xl font-semibold">Sign in</h1>

	{#if data.notice}
		<p class="mb-4 text-sm font-normal text-blue-700" role="status">{data.notice}</p>
	{/if}

	<form method="POST">
		<FieldGroup>
			<Field>
				<FieldLabel for="email-{id}">Email</FieldLabel>
				<Input id="email-{id}" name="email" type="email" autocomplete="email" required />
			</Field>

			<Field>
				<FieldLabel for="password-{id}">Password</FieldLabel>
				<PasswordInput id="password-{id}" name="password" autocomplete="current-password" />
			</Field>

			{#if form?.message}
				<FieldError errors={[{ message: form.message }]} />
			{/if}

			<Field>
				<Button type="submit">Sign in</Button>
			</Field>
		</FieldGroup>
	</form>
</main>
