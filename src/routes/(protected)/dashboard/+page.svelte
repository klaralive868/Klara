<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Field, FieldGroup, FieldLabel, FieldError } from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const id = $props.id();
</script>

<main class="mx-auto mt-16 max-w-sm">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-xl font-semibold">Dashboard</h1>

		{#if data.isOperator}
			<details class="relative">
				<summary class="cursor-pointer list-none rounded-3xl border border-input px-3 py-1 text-sm">
					Menu
				</summary>
				<div
					class="absolute right-0 z-10 mt-2 min-w-28 rounded-md border border-border bg-popover p-1 shadow-md"
				>
					<a href={resolve('/admin')} class="block rounded px-3 py-1.5 text-sm hover:bg-muted"
						>Admin</a
					>
				</div>
			</details>
		{/if}
	</div>

	<form method="POST" action="?/signOut" class="mb-10">
		<Button type="submit">Sign out</Button>
	</form>

	<h2 class="mb-2 text-lg font-semibold">Modules</h2>
	<div class="mb-10">
		<a href={resolve('/dashboard/catalog')} class="text-sm text-primary hover:underline">
			Catalog
		</a>
	</div>

	<h2 class="mb-4 text-lg font-semibold">Invite a teammate</h2>

	<form method="POST" action="?/invite">
		<FieldGroup>
			<Field>
				<FieldLabel for="invite-email-{id}">Email</FieldLabel>
				<Input id="invite-email-{id}" name="email" type="email" required />
			</Field>

			<Field>
				<FieldLabel for="invite-role-{id}">Role</FieldLabel>
				<select
					id="invite-role-{id}"
					name="role"
					required
					class="h-9 w-full rounded-3xl border border-input bg-transparent px-3 text-sm"
				>
					<option value="staff">Staff</option>
					<option value="manager">Manager</option>
					<option value="owner">Owner</option>
				</select>
			</Field>

			{#if form?.inviteMessage}
				{#if form.success}
					<p class="text-sm font-normal text-green-700" role="status">{form.inviteMessage}</p>
				{:else}
					<FieldError errors={[{ message: form.inviteMessage }]} />
				{/if}
			{/if}

			<Field>
				<Button type="submit">Send invite</Button>
			</Field>
		</FieldGroup>
	</form>
</main>
