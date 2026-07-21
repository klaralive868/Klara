<script lang="ts">
	import { GENDERED_SIZES, sizesForScheme, type SizingScheme } from '$lib/catalog/material-types';

	let {
		sizingScheme,
		quantities = $bindable({})
	}: { sizingScheme: SizingScheme; quantities: Record<string, number> } = $props();

	function setQuantity(size: string, raw: string) {
		const parsed = Number(raw);
		quantities = { ...quantities, [size]: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0 };
	}
</script>

{#if sizingScheme === 'none'}
	<label class="flex items-center gap-2 text-sm">
		Quantity
		<input
			type="number"
			min="0"
			step="1"
			value={quantities.quantity ?? 0}
			oninput={(event) => setQuantity('quantity', event.currentTarget.value)}
			class="h-9 w-24 rounded-3xl border border-input bg-transparent px-3 text-sm"
		/>
	</label>
{:else if sizingScheme === 'gendered'}
	<div class="space-y-3">
		<div>
			<p class="mb-1.5 text-sm font-medium">Male sizes</p>
			<div class="flex flex-wrap gap-2">
				{#each GENDERED_SIZES.male as size (size)}
					{@const label = `Male ${size}`}
					<label class="flex items-center gap-1.5 text-sm">
						{size}
						<input
							type="number"
							min="0"
							step="1"
							value={quantities[label] ?? 0}
							oninput={(event) => setQuantity(label, event.currentTarget.value)}
							class="h-9 w-16 rounded-3xl border border-input bg-transparent px-2 text-sm"
						/>
					</label>
				{/each}
			</div>
		</div>

		<div>
			<p class="mb-1.5 text-sm font-medium">Female sizes</p>
			<div class="flex flex-wrap gap-2">
				{#each GENDERED_SIZES.female as size (size)}
					{@const label = `Female ${size}`}
					<label class="flex items-center gap-1.5 text-sm">
						{size}
						<input
							type="number"
							min="0"
							step="1"
							value={quantities[label] ?? 0}
							oninput={(event) => setQuantity(label, event.currentTarget.value)}
							class="h-9 w-16 rounded-3xl border border-input bg-transparent px-2 text-sm"
						/>
					</label>
				{/each}
			</div>
		</div>
	</div>
{:else}
	<div class="flex flex-wrap gap-2">
		{#each sizesForScheme(sizingScheme) as size (size)}
			<label class="flex items-center gap-1.5 text-sm">
				{size}
				<input
					type="number"
					min="0"
					step="1"
					value={quantities[size] ?? 0}
					oninput={(event) => setQuantity(size, event.currentTarget.value)}
					class="h-9 w-16 rounded-3xl border border-input bg-transparent px-2 text-sm"
				/>
			</label>
		{/each}
	</div>
{/if}
