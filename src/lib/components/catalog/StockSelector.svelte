<script lang="ts">
	import { GENDERED_SIZES, sizesForScheme, type SizingScheme } from '$lib/catalog/material-types';

	let {
		sizingScheme,
		quantities = $bindable({})
	}: { sizingScheme: SizingScheme; quantities: Record<string, number> } = $props();

	// Tracks each input's raw text so the field can be blanked out or hold an
	// in-progress value (e.g. "1" while typing "12") without the reactive
	// `quantities` default snapping it back to "0" on every keystroke —
	// `quantities` itself is only ever updated with a clamped, whole number.
	let rawValues = $state<Record<string, string>>({});

	function displayValue(size: string) {
		return rawValues[size] ?? String(quantities[size] ?? 0);
	}

	function setQuantity(size: string, raw: string) {
		rawValues[size] = raw;
		const parsed = Math.trunc(Number(raw));
		quantities = {
			...quantities,
			[size]: raw !== '' && Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
		};
	}

	// On blur, drop the raw override so the field re-displays the committed,
	// clamped-to-integer value — otherwise something like "3.7" would stay
	// on screen even though 3 is what actually got committed.
	function normalizeOnBlur(size: string) {
		if (!(size in rawValues)) return;
		const next = { ...rawValues };
		delete next[size];
		rawValues = next;
	}
</script>

{#snippet quantityInput(size: string, label: string, className: string)}
	<label class="flex items-center gap-1.5 text-sm">
		{label}
		<input
			type="number"
			min="0"
			step="1"
			value={displayValue(size)}
			oninput={(event) => setQuantity(size, event.currentTarget.value)}
			onblur={() => normalizeOnBlur(size)}
			class={className}
		/>
	</label>
{/snippet}

{#if sizingScheme === 'none'}
	{@render quantityInput(
		'quantity',
		'Quantity',
		'h-9 w-24 rounded-3xl border border-input bg-transparent px-3 text-sm'
	)}
{:else if sizingScheme === 'gendered'}
	<div class="space-y-3">
		<div>
			<p class="mb-1.5 text-sm font-medium">Male sizes</p>
			<div class="flex flex-wrap gap-2">
				{#each GENDERED_SIZES.male as size (size)}
					{@render quantityInput(
						`Male ${size}`,
						size,
						'h-9 w-16 rounded-3xl border border-input bg-transparent px-2 text-sm'
					)}
				{/each}
			</div>
		</div>

		<div>
			<p class="mb-1.5 text-sm font-medium">Female sizes</p>
			<div class="flex flex-wrap gap-2">
				{#each GENDERED_SIZES.female as size (size)}
					{@render quantityInput(
						`Female ${size}`,
						size,
						'h-9 w-16 rounded-3xl border border-input bg-transparent px-2 text-sm'
					)}
				{/each}
			</div>
		</div>
	</div>
{:else}
	<div class="flex flex-wrap gap-2">
		{#each sizesForScheme(sizingScheme) as size (size)}
			{@render quantityInput(
				size,
				size,
				'h-9 w-16 rounded-3xl border border-input bg-transparent px-2 text-sm'
			)}
		{/each}
	</div>
{/if}
