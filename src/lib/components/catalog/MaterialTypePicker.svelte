<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { COMMON_MATERIAL_TYPES, MORE_MATERIAL_TYPES } from '$lib/catalog/material-types';

	let { value = $bindable('') }: { value: string } = $props();

	let showMore = $state(false);

	function select(key: string) {
		value = key;
		showMore = false;
	}
</script>

<div class="flex flex-wrap gap-2">
	{#each COMMON_MATERIAL_TYPES as type (type.key)}
		<Button
			type="button"
			variant={value === type.key ? 'default' : 'outline'}
			size="sm"
			onclick={() => select(type.key)}
		>
			{type.label}
		</Button>
	{/each}

	<Button type="button" variant="ghost" size="sm" onclick={() => (showMore = true)}>
		+ More materials
	</Button>
</div>

{#if showMore}
	<div class="fixed inset-0 z-20 flex items-center justify-center bg-black/40">
		<div
			role="dialog"
			aria-modal="true"
			aria-label="More materials"
			class="w-full max-w-sm rounded-lg border border-border bg-popover p-4 shadow-lg"
		>
			<div class="mb-3 flex items-center justify-between">
				<h3 class="text-sm font-semibold">More materials</h3>
				<Button type="button" variant="ghost" size="icon-sm" onclick={() => (showMore = false)}>
					×
				</Button>
			</div>

			<div class="flex flex-wrap gap-2">
				{#each MORE_MATERIAL_TYPES as type (type.key)}
					<Button
						type="button"
						variant={value === type.key ? 'default' : 'outline'}
						size="sm"
						onclick={() => select(type.key)}
					>
						{type.label}
					</Button>
				{/each}
			</div>
		</div>
	</div>
{/if}
