<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { FieldError } from '$lib/components/ui/field/index.js';
	import type { CatalogCategory } from '$lib/catalog/types';

	let { categories, message }: { categories: readonly CatalogCategory[]; message?: string } =
		$props();

	const topLevel = $derived(categories.filter((category) => category.parentId === null));

	function subcategoriesOf(parentId: string) {
		return categories.filter((category) => category.parentId === parentId);
	}
</script>

<div class="space-y-6">
	{#if message}
		<FieldError errors={[{ message }]} />
	{/if}

	<ul class="space-y-4">
		{#each topLevel as category (category.id)}
			<li
				class="rounded-lg border border-border p-3"
				data-testid="category-row"
				data-category-name={category.name}
			>
				<form method="POST" action="?/rename" class="flex items-center gap-2">
					<input type="hidden" name="id" value={category.id} />
					<Input name="name" value={category.name} aria-label="Category name" class="max-w-xs" />
					<Button type="submit">Save</Button>
					<Button type="submit" formaction="?/delete" variant="outline">Delete</Button>
				</form>

				<ul class="mt-3 ml-6 space-y-2">
					{#each subcategoriesOf(category.id) as subcategory (subcategory.id)}
						<li data-testid="subcategory-row" data-category-name={subcategory.name}>
							<form method="POST" action="?/rename" class="flex items-center gap-2">
								<input type="hidden" name="id" value={subcategory.id} />
								<Input
									name="name"
									value={subcategory.name}
									aria-label="Subcategory name"
									class="max-w-xs"
								/>
								<Button type="submit">Save</Button>
								<Button type="submit" formaction="?/delete" variant="outline">Delete</Button>
							</form>
						</li>
					{/each}
				</ul>

				<form method="POST" action="?/createSubcategory" class="mt-3 ml-6 flex items-center gap-2">
					<input type="hidden" name="parentId" value={category.id} />
					<Input
						name="name"
						placeholder="New subcategory"
						aria-label="New subcategory name for {category.name}"
						class="max-w-xs"
					/>
					<Button type="submit" variant="outline">Add subcategory</Button>
				</form>
			</li>
		{:else}
			<li class="text-sm text-muted-foreground">No categories yet.</li>
		{/each}
	</ul>

	<form method="POST" action="?/createTopLevel" class="flex items-center gap-2">
		<Input
			name="name"
			placeholder="New top-level category"
			aria-label="New top-level category name"
			class="max-w-xs"
		/>
		<Button type="submit">Add category</Button>
	</form>
</div>
