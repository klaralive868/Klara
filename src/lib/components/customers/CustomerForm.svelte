<script lang="ts">
	import { untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Field, FieldGroup, FieldLabel, FieldError } from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import type { Customer, CustomerFieldDefinition } from '$lib/customers/types';

	let {
		initial,
		fieldDefinitions,
		message
	}: {
		initial?: Customer;
		fieldDefinitions: readonly CustomerFieldDefinition[];
		message?: string;
	} = $props();

	const id = $props.id();

	// Deliberately captures `initial`/`fieldDefinitions` only once, to seed
	// editable local state — not to stay in sync with the props afterwards
	// (same convention as CatalogItemForm).
	let fullName = $state(untrack(() => initial?.fullName ?? ''));
	let email = $state(untrack(() => initial?.email ?? ''));
	let phone = $state(untrack(() => initial?.phone ?? ''));

	let customFieldValues = $state<Record<string, string>>(
		untrack(() => {
			const values: Record<string, string> = {};
			for (const def of fieldDefinitions) {
				const raw = initial?.customFields?.[def.fieldKey];
				values[def.fieldKey] = raw === undefined || raw === null ? '' : String(raw);
			}
			return values;
		})
	);
</script>

<form method="POST" action={initial ? '?/update' : undefined} class="max-w-lg space-y-6">
	<FieldGroup>
		<Field>
			<FieldLabel for="fullName-{id}">Name</FieldLabel>
			<Input id="fullName-{id}" name="fullName" bind:value={fullName} required />
		</Field>

		<Field>
			<FieldLabel for="email-{id}">Email</FieldLabel>
			<Input id="email-{id}" name="email" type="email" bind:value={email} />
		</Field>

		<Field>
			<FieldLabel for="phone-{id}">Phone</FieldLabel>
			<Input id="phone-{id}" name="phone" type="tel" bind:value={phone} />
		</Field>
	</FieldGroup>

	{#if fieldDefinitions.length > 0}
		<FieldGroup>
			{#each fieldDefinitions as def (def.id)}
				<Field>
					<FieldLabel for="custom-{def.fieldKey}-{id}">
						{def.label}{#if def.required}
							<span aria-hidden="true">*</span>
						{/if}
					</FieldLabel>
					{#if def.fieldType === 'select'}
						<select
							id="custom-{def.fieldKey}-{id}"
							name="custom_{def.fieldKey}"
							required={def.required}
							bind:value={customFieldValues[def.fieldKey]}
							class="h-9 w-full rounded-3xl border border-input bg-transparent px-3 text-sm"
						>
							<option value="">Select…</option>
							{#each def.options ?? [] as option (option)}
								<option value={option}>{option}</option>
							{/each}
						</select>
					{:else}
						<Input
							id="custom-{def.fieldKey}-{id}"
							name="custom_{def.fieldKey}"
							type={def.fieldType === 'number' ? 'number' : def.fieldType === 'date' ? 'date' : 'text'}
							required={def.required}
							bind:value={customFieldValues[def.fieldKey]}
						/>
					{/if}
				</Field>
			{/each}
		</FieldGroup>
	{/if}

	{#if message}
		<FieldError errors={[{ message }]} />
	{/if}

	<Field>
		<Button type="submit">{initial ? 'Save customer' : 'Add customer'}</Button>
	</Field>
</form>
