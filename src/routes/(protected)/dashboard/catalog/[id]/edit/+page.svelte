<script lang="ts">
	import CatalogItemForm from '$lib/components/catalog/CatalogItemForm.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<main class="mx-auto mt-16 max-w-sm">
	<h1 class="mb-6 text-xl font-semibold">Edit item</h1>

	{#if form?.success}
		<p class="mb-4 text-sm font-normal text-green-700" role="status">{form.message}</p>
	{/if}

	<CatalogItemForm
		initial={data.item}
		initialCategoryIds={data.categoryIds}
		categories={data.categories}
		images={data.images}
		message={form?.success ? undefined : form?.message}
	/>
</main>
