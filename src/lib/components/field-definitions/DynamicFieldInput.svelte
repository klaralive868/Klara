<script lang="ts">
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { fieldInputName, type FieldDefinition } from '$lib/field-definitions/types';

	let {
		definition,
		value = $bindable(),
		idSuffix
	}: {
		definition: FieldDefinition;
		value: string | boolean | string[];
		idSuffix: string;
	} = $props();

	const name = $derived(fieldInputName(definition.fieldKey));
	const inputId = $derived(`field-${definition.fieldKey}-${idSuffix}`);

	function toggleMultiSelectOption(option: string, checked: boolean) {
		const current = value as string[];
		value = checked ? [...current, option] : current.filter((v) => v !== option);
	}
</script>

{#if definition.fieldType === 'select'}
	<select
		id={inputId}
		{name}
		required={definition.required}
		bind:value={value as string}
		class="h-9 w-full rounded-3xl border border-input bg-transparent px-3 text-sm"
	>
		<option value="">Select…</option>
		{#each definition.options ?? [] as option (option)}
			<option value={option}>{option}</option>
		{/each}
	</select>
{:else if definition.fieldType === 'boolean'}
	<input type="hidden" {name} value={value as boolean} />
	<Checkbox id={inputId} bind:checked={value as boolean} />
{:else if definition.fieldType === 'multi_select'}
	<div class="space-y-2">
		{#each definition.options ?? [] as option (option)}
			{@const checked = (value as string[]).includes(option)}
			<label class="flex items-center gap-2 text-sm font-normal">
				<Checkbox
					{checked}
					onCheckedChange={(next: boolean) => toggleMultiSelectOption(option, next)}
				/>
				{option}
				<input type="hidden" {name} value={option} disabled={!checked} />
			</label>
		{/each}
	</div>
{:else}
	<Input
		id={inputId}
		{name}
		type={definition.fieldType === 'number' ? 'number' : definition.fieldType === 'date' ? 'date' : 'text'}
		required={definition.required}
		bind:value={value as string}
	/>
{/if}
