<script lang="ts">
	import { GENDERED_SIZES, sizesForScheme, type SizingScheme } from '$lib/catalog/material-types';

	let {
		sizingScheme,
		selected = $bindable([])
	}: { sizingScheme: SizingScheme; selected: string[] } = $props();

	function toggle(size: string) {
		selected = selected.includes(size) ? selected.filter((s) => s !== size) : [...selected, size];
	}
</script>

{#if sizingScheme === 'none'}
	<p class="text-sm text-muted-foreground">This material type doesn't need sizing.</p>
{:else if sizingScheme === 'gendered'}
	<div class="space-y-3">
		<div>
			<p class="mb-1.5 text-sm font-medium">Male sizes</p>
			<div class="flex flex-wrap gap-2">
				{#each GENDERED_SIZES.male as size (size)}
					{@const label = `Male ${size}`}
					<label
						class="flex items-center gap-1.5 rounded-3xl border border-input px-3 py-1 text-sm"
					>
						<input
							type="checkbox"
							checked={selected.includes(label)}
							onchange={() => toggle(label)}
						/>
						{size}
					</label>
				{/each}
			</div>
		</div>

		<div>
			<p class="mb-1.5 text-sm font-medium">Female sizes</p>
			<div class="flex flex-wrap gap-2">
				{#each GENDERED_SIZES.female as size (size)}
					{@const label = `Female ${size}`}
					<label
						class="flex items-center gap-1.5 rounded-3xl border border-input px-3 py-1 text-sm"
					>
						<input
							type="checkbox"
							checked={selected.includes(label)}
							onchange={() => toggle(label)}
						/>
						{size}
					</label>
				{/each}
			</div>
		</div>
	</div>
{:else}
	<div class="flex flex-wrap gap-2">
		{#each sizesForScheme(sizingScheme) as size (size)}
			<label class="flex items-center gap-1.5 rounded-3xl border border-input px-3 py-1 text-sm">
				<input type="checkbox" checked={selected.includes(size)} onchange={() => toggle(size)} />
				{size}
			</label>
		{/each}
	</div>
{/if}
