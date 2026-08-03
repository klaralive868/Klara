<script lang="ts">
	import { Field, FieldGroup, FieldLabel } from '$lib/components/ui/field/index.js';
	import DynamicFieldInput from './DynamicFieldInput.svelte';
	import type { FieldDefinition } from '$lib/field-definitions/types';

	// Shared dynamic-form-renderer (ADR-0011): given a module's active field
	// definitions (core and custom alike — both render identically here,
	// only their server-side write destination differs) and a values map
	// keyed by field_key, renders the matching input for each. Reused by
	// every entity_type's create/edit form (Customers now, Orders next) —
	// not rebuilt per module.
	let {
		definitions,
		values = $bindable(),
		idSuffix
	}: {
		definitions: readonly FieldDefinition[];
		values: Record<string, string | boolean | string[]>;
		idSuffix: string;
	} = $props();
</script>

{#if definitions.length > 0}
	<FieldGroup>
		{#each definitions as definition (definition.id)}
			<Field>
				<FieldLabel for="field-{definition.fieldKey}-{idSuffix}">
					{definition.label}{#if definition.required}
						<span aria-hidden="true">*</span>
					{/if}
				</FieldLabel>
				<DynamicFieldInput {definition} bind:value={values[definition.fieldKey]} {idSuffix} />
			</Field>
		{/each}
	</FieldGroup>
{/if}
