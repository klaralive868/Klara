<script lang="ts">
	import PlusCircleIcon from '@lucide/svelte/icons/circle-plus';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Field, FieldGroup, FieldLabel } from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';

	// Plain min/max inputs, not a slider (ADR-0011): typing an exact bound
	// ("orders over $500") beats dragging a handle to an approximate
	// position for business data, and a slider needs known min/max bounds
	// up front that this filter has no reason to compute.
	let {
		title,
		min = $bindable(null),
		max = $bindable(null)
	}: { title: string; min: number | null; max: number | null } = $props();

	let open = $state(false);
	// Svelte coerces bind:value on <input type="number"> to an actual
	// number (or empty string when the field is blank/invalid) — never
	// treat these as always-string values.
	let draftMin = $state<number | string | null>(min);
	let draftMax = $state<number | string | null>(max);

	function toNullableNumber(value: number | string | null): number | null {
		if (value === null || value === '') return null;
		const parsed = typeof value === 'number' ? value : Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}

	function apply() {
		min = toNullableNumber(draftMin);
		max = toNullableNumber(draftMax);
		open = false;
	}

	function clear() {
		draftMin = null;
		draftMax = null;
		min = null;
		max = null;
		open = false;
	}

	const active = $derived(min !== null || max !== null);
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="outline" size="sm" class="border-dashed">
				<PlusCircleIcon />
				{title}
				{#if active}
					<Badge variant="secondary" class="rounded-sm">
						{min ?? '−∞'}–{max ?? '∞'}
					</Badge>
				{/if}
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-64" align="start">
		<FieldGroup>
			<Field>
				<FieldLabel for="range-min">Min</FieldLabel>
				<Input id="range-min" type="number" bind:value={draftMin} />
			</Field>
			<Field>
				<FieldLabel for="range-max">Max</FieldLabel>
				<Input id="range-max" type="number" bind:value={draftMax} />
			</Field>
			<div class="flex justify-end gap-2">
				<Button variant="ghost" size="sm" onclick={clear}>Clear</Button>
				<Button size="sm" onclick={apply}>Apply</Button>
			</div>
		</FieldGroup>
	</Popover.Content>
</Popover.Root>
