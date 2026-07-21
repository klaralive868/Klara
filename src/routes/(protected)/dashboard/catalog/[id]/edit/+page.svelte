<script lang="ts">
	import CatalogItemForm from '$lib/components/catalog/CatalogItemForm.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<main class="mx-auto mt-16 max-w-sm">
	<h1 class="mb-6 text-xl font-semibold">Edit item</h1>
	<CatalogItemForm initial={data.item} />
</main>
