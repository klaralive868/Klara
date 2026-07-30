<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';

	let {
		stockBySize,
		stockTotal,
		unlimitedStock
	}: { stockBySize: Record<string, number>; stockTotal: number; unlimitedStock: boolean } =
		$props();

	const breakdown = $derived(
		Object.entries(stockBySize)
			.filter(([, quantity]) => quantity > 0)
			.map(([size, quantity]) => [size === 'quantity' ? 'Qty' : size, quantity] as const)
	);
</script>

{#if unlimitedStock}
	<Badge variant="secondary">Unlimited</Badge>
{:else if breakdown.length === 0}
	<span class="text-muted-foreground">{stockTotal}</span>
{:else}
	<Tooltip.Root delayDuration={150}>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<span {...props} class="cursor-default underline decoration-dotted underline-offset-4">
					{stockTotal}
				</span>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content side="right">
			<ul class="space-y-0.5">
				{#each breakdown as [size, quantity] (size)}
					<li class="flex items-center justify-between gap-3">
						<span>{size}</span>
						<span>{quantity}</span>
					</li>
				{/each}
			</ul>
		</Tooltip.Content>
	</Tooltip.Root>
{/if}
