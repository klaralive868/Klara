<script lang="ts">
	import CatalogItemForm from '$lib/components/catalog/CatalogItemForm.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<main class="mx-auto mt-16 max-w-sm">
	<h1 class="mb-6 text-xl font-semibold">Add item</h1>
	<CatalogItemForm message={form?.message} />
</main>
