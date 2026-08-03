<script lang="ts">
	import { Input } from '$lib/components/ui/input/index.js';
	import DataTableFacetedFilter from '$lib/components/catalog/data-table-faceted-filter.svelte';
	import DataTableNumberRangeFilter from './DataTableNumberRangeFilter.svelte';
	import DataTableDateRangeFilter from './DataTableDateRangeFilter.svelte';
	import { BOOLEAN_FACET_OPTIONS } from '$lib/field-definitions/table-columns';
	import type { FieldDefinition } from '$lib/field-definitions/types';
	import type { ColumnFiltersState } from '@tanstack/table-core';

	// Owns per-field filter UI state (search text, facet sets, ranges) and
	// derives a TanStack-shaped ColumnFiltersState from it — the shared
	// filter bar reused by every module's dynamic table columns (ADR-0011).
	// Filter *logic* per type lives in table-columns.ts; this only owns the
	// UI state feeding it.
	let {
		definitions,
		// eslint-disable-next-line no-useless-assignment -- write-only $bindable output prop: this component derives filters and hands it to the parent, it never reads its own value back
		filters = $bindable()
	}: {
		definitions: readonly FieldDefinition[];
		filters: ColumnFiltersState;
	} = $props();

	let textValues = $state<Record<string, string>>({});
	let facetValues = $state<Record<string, Set<string>>>({});
	let numberRanges = $state<Record<string, { min: number | null; max: number | null }>>({});
	let dateRanges = $state<Record<string, { from: string | null; to: string | null }>>({});

	export function reset() {
		textValues = {};
		facetValues = {};
		numberRanges = {};
		dateRanges = {};
	}

	// Mutating state from a template expression ({@const}) is illegal in
	// Svelte 5 — lazily creating a field's range-filter slot has to happen
	// here instead, a real effect, not at read time in the markup below.
	// Runs before paint (not after, like a plain $effect), so by the time a
	// user can see/interact with a range filter, its slot already exists.
	$effect.pre(() => {
		for (const def of definitions) {
			if (def.fieldType === 'number' && !(def.fieldKey in numberRanges)) {
				numberRanges[def.fieldKey] = { min: null, max: null };
			} else if (def.fieldType === 'date' && !(def.fieldKey in dateRanges)) {
				dateRanges[def.fieldKey] = { from: null, to: null };
			} else if (
				(def.fieldType === 'select' ||
					def.fieldType === 'multi_select' ||
					def.fieldType === 'boolean') &&
				!(def.fieldKey in facetValues)
			) {
				// DataTableFacetedFilter's `selected` is `$bindable(new Set())` —
				// Svelte 5 forbids binding a path that's still undefined into a
				// prop with a bindable fallback, so this slot must exist before
				// the template below ever binds to it (same reasoning as
				// numberRanges/dateRanges above).
				facetValues[def.fieldKey] = new Set();
			}
		}
	});

	$effect(() => {
		filters = definitions
			.map((def) => {
				if (def.fieldType === 'text') return { id: def.fieldKey, value: textValues[def.fieldKey] ?? '' };
				if (def.fieldType === 'select' || def.fieldType === 'boolean' || def.fieldType === 'multi_select') {
					return { id: def.fieldKey, value: facetValues[def.fieldKey] ?? new Set() };
				}
				if (def.fieldType === 'number') {
					// Read .min/.max explicitly, not just the object reference —
					// DataTableNumberRangeFilter mutates those fields in place
					// (bind:min/bind:max into this same object), and an effect
					// only re-runs on properties it actually reads, not on
					// mutations to an object it merely held a reference to.
					const range = numberRanges[def.fieldKey];
					return { id: def.fieldKey, value: { min: range?.min ?? null, max: range?.max ?? null } };
				}
				if (def.fieldType === 'date') {
					const range = dateRanges[def.fieldKey];
					return { id: def.fieldKey, value: { from: range?.from ?? null, to: range?.to ?? null } };
				}
				return { id: def.fieldKey, value: undefined };
			})
			.filter((f) => f.value !== undefined);
	});
</script>

{#each definitions as def (def.id)}
	{#if def.fieldType === 'text'}
		<Input
			placeholder={`Search ${def.label.toLowerCase()}…`}
			bind:value={textValues[def.fieldKey]}
			class="h-9 w-48"
			aria-label={`Search by ${def.label}`}
		/>
	{:else if def.fieldType === 'select'}
		<DataTableFacetedFilter
			title={def.label}
			options={(def.options ?? []).map((o) => ({ value: o, label: o }))}
			bind:selected={facetValues[def.fieldKey]}
		/>
	{:else if def.fieldType === 'multi_select'}
		<DataTableFacetedFilter
			title={def.label}
			options={(def.options ?? []).map((o) => ({ value: o, label: o }))}
			bind:selected={facetValues[def.fieldKey]}
		/>
	{:else if def.fieldType === 'boolean'}
		<DataTableFacetedFilter
			title={def.label}
			options={BOOLEAN_FACET_OPTIONS}
			bind:selected={facetValues[def.fieldKey]}
		/>
	{:else if def.fieldType === 'number' && numberRanges[def.fieldKey]}
		{@const range = numberRanges[def.fieldKey]}
		<DataTableNumberRangeFilter title={def.label} bind:min={range.min} bind:max={range.max} />
	{:else if def.fieldType === 'date' && dateRanges[def.fieldKey]}
		{@const range = dateRanges[def.fieldKey]}
		<DataTableDateRangeFilter title={def.label} bind:from={range.from} bind:to={range.to} />
	{/if}
{/each}
