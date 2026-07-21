<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { COMMON_MATERIAL_TYPES, MORE_MATERIAL_TYPES } from '$lib/catalog/material-types';

	let { value = $bindable('') }: { value: string } = $props();

	let showMore = $state(false);

	function select(key: string) {
		value = key;
		showMore = false;
	}

	function close() {
		showMore = false;
	}

	function onWindowKeydown(event: KeyboardEvent) {
		if (showMore && event.key === 'Escape') {
			close();
		}
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

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
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-20 flex items-center justify-center bg-black/40" onclick={close}>
		<div
			role="dialog"
			aria-modal="true"
			aria-label="More materials"
			tabindex="-1"
			class="w-full max-w-sm rounded-lg border border-border bg-popover p-4 shadow-lg"
			onclick={(event) => event.stopPropagation()}
		>
			<div class="mb-3 flex items-center justify-between">
				<h3 class="text-sm font-semibold">More materials</h3>
				<Button type="button" variant="ghost" size="icon-sm" onclick={close}>×</Button>
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
