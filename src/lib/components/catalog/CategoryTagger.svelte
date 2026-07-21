<script lang="ts">
	import type { CatalogCategory } from '$lib/catalog/types';

	let {
		categories,
		selected = $bindable([])
	}: { categories: readonly CatalogCategory[]; selected: string[] } = $props();

	const topLevel = $derived(categories.filter((category) => category.parentId === null));

	function subcategoriesOf(parentId: string) {
		return categories.filter((category) => category.parentId === parentId);
	}

	function toggle(id: string) {
		selected = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
	}
</script>

<ul class="space-y-2">
	{#each topLevel as category (category.id)}
		<li>
			<label class="flex items-center gap-1.5 text-sm">
				<input
					type="checkbox"
					name="categoryIds"
					value={category.id}
					checked={selected.includes(category.id)}
					onchange={() => toggle(category.id)}
				/>
				{category.name}
			</label>

			{#if subcategoriesOf(category.id).length > 0}
				<ul role="group" class="ml-6 space-y-1">
					{#each subcategoriesOf(category.id) as subcategory (subcategory.id)}
						<li>
							<label class="flex items-center gap-1.5 text-sm">
								<input
									type="checkbox"
									name="categoryIds"
									value={subcategory.id}
									checked={selected.includes(subcategory.id)}
									onchange={() => toggle(subcategory.id)}
								/>
								{subcategory.name}
							</label>
						</li>
					{/each}
				</ul>
			{/if}
		</li>
	{:else}
		<li class="text-sm text-muted-foreground">No categories yet.</li>
	{/each}
</ul>
