<script lang="ts">
	import CategoryManager from '$lib/components/catalog/CategoryManager.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<main class="mx-auto mt-16 max-w-lg">
	<h1 class="mb-6 text-xl font-semibold">Categories</h1>
	<CategoryManager initial={data.categories} />
</main>
