<script lang="ts">
	import { untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Field, FieldGroup, FieldLabel, FieldError } from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import DynamicFieldGroup from '$lib/components/field-definitions/DynamicFieldGroup.svelte';
	import type { Customer } from '$lib/customers/types';
	import type { FieldDefinition } from '$lib/field-definitions/types';

	let {
		initial,
		fieldDefinitions,
		message
	}: {
		initial?: Customer;
		fieldDefinitions: readonly FieldDefinition[];
		message?: string;
	} = $props();

	const id = $props.id();

	// Deliberately captures `initial`/`fieldDefinitions` only once, to seed
	// editable local state — not to stay in sync with the props afterwards
	// (same convention as CatalogItemForm).
	let fullName = $state(untrack(() => initial?.fullName ?? ''));

	// A definition's initial value comes from the real column (email/phone)
	// when is_core, or from custom_fields keyed by field_key otherwise —
	// both routed through the same DynamicFieldGroup either way, since
	// storage destination is a server-side concern only (ADR-0011).
	let values = $state<Record<string, string | boolean | string[]>>(
		untrack(() => {
			const result: Record<string, string | boolean | string[]> = {};
			for (const def of fieldDefinitions) {
				let raw: unknown;
				if (def.isCore) {
					raw = def.fieldKey === 'email' ? initial?.email : initial?.phone;
				} else {
					raw = initial?.customFields?.[def.fieldKey];
				}
				if (def.fieldType === 'boolean') {
					result[def.fieldKey] = raw === true;
				} else if (def.fieldType === 'multi_select') {
					result[def.fieldKey] = Array.isArray(raw) ? (raw as string[]) : [];
				} else {
					result[def.fieldKey] = raw === undefined || raw === null ? '' : String(raw);
				}
			}
			return result;
		})
	);
</script>

<form method="POST" action={initial ? '?/update' : undefined} class="max-w-lg space-y-6">
	<FieldGroup>
		<Field>
			<FieldLabel for="fullName-{id}">Name</FieldLabel>
			<Input id="fullName-{id}" name="fullName" bind:value={fullName} required />
		</Field>
	</FieldGroup>

	<DynamicFieldGroup definitions={fieldDefinitions} bind:values idSuffix={id} />

	{#if message}
		<FieldError errors={[{ message }]} />
	{/if}

	<Field>
		<Button type="submit">{initial ? 'Save customer' : 'Add customer'}</Button>
	</Field>
</form>
