<script lang="ts">
	import { untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import type { PlaceholderCategory } from '$lib/catalog/placeholder-categories';

	let { initial }: { initial: readonly PlaceholderCategory[] } = $props();

	// Local-only editable copy — this ticket has no backend yet (#17 wires
	// real persistence), so create/rename/delete only affect this page's
	// in-memory state.
	let categories = $state<PlaceholderCategory[]>(untrack(() => [...initial]));

	const topLevel = $derived(categories.filter((category) => category.parentId === null));

	function subcategoriesOf(parentId: string) {
		return categories.filter((category) => category.parentId === parentId);
	}

	function slugify(name: string) {
		return (
			name
				.trim()
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/(^-|-$)/g, '') || crypto.randomUUID()
		);
	}

	function uniqueId(base: string) {
		let id = base;
		let suffix = 2;
		while (categories.some((category) => category.id === id)) {
			id = `${base}-${suffix}`;
			suffix += 1;
		}
		return id;
	}

	let newTopLevelName = $state('');
	function addTopLevelCategory() {
		const name = newTopLevelName.trim();
		if (!name) return;
		categories.push({ id: uniqueId(slugify(name)), name, parentId: null });
		newTopLevelName = '';
	}

	let newSubcategoryNames = $state<Record<string, string>>({});
	function addSubcategory(parentId: string) {
		const name = (newSubcategoryNames[parentId] ?? '').trim();
		if (!name) return;
		categories.push({ id: uniqueId(slugify(name)), name, parentId });
		newSubcategoryNames[parentId] = '';
	}

	function deleteCategory(id: string) {
		const isTopLevel = categories.some(
			(category) => category.id === id && category.parentId === null
		);
		if (isTopLevel) {
			// Deleting a top-level category also removes its subcategories —
			// there's nowhere left for them to be nested under.
			categories = categories.filter((category) => category.id !== id && category.parentId !== id);
		} else {
			categories = categories.filter((category) => category.id !== id);
		}
	}
</script>

<div class="space-y-6">
	<ul class="space-y-4">
		{#each topLevel as category (category.id)}
			<li class="rounded-lg border border-border p-3">
				<div class="flex items-center gap-2">
					<Input bind:value={category.name} aria-label="Category name" class="max-w-xs" />
					<Button
						type="button"
						variant="outline"
						size="sm"
						onclick={() => deleteCategory(category.id)}
					>
						Delete
					</Button>
				</div>

				<ul class="mt-3 ml-6 space-y-2">
					{#each subcategoriesOf(category.id) as subcategory (subcategory.id)}
						<li class="flex items-center gap-2">
							<Input bind:value={subcategory.name} aria-label="Subcategory name" class="max-w-xs" />
							<Button
								type="button"
								variant="outline"
								size="sm"
								onclick={() => deleteCategory(subcategory.id)}
							>
								Delete
							</Button>
						</li>
					{/each}
				</ul>

				<div class="mt-3 ml-6 flex items-center gap-2">
					<Input
						bind:value={newSubcategoryNames[category.id]}
						placeholder="New subcategory"
						aria-label="New subcategory name for {category.name}"
						class="max-w-xs"
					/>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onclick={() => addSubcategory(category.id)}
					>
						Add subcategory
					</Button>
				</div>
			</li>
		{:else}
			<li class="text-sm text-muted-foreground">No categories yet.</li>
		{/each}
	</ul>

	<div class="flex items-center gap-2">
		<Input
			bind:value={newTopLevelName}
			placeholder="New top-level category"
			aria-label="New top-level category name"
			class="max-w-xs"
		/>
		<Button type="button" onclick={addTopLevelCategory}>Add category</Button>
	</div>
</div>
