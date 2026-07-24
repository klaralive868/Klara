<script lang="ts">
	import { resolve } from '$app/paths';
	import type { CatalogItemListRow } from '$lib/catalog/types';

	let { item }: { item: CatalogItemListRow } = $props();
</script>

<a href={resolve(`/dashboard/catalog/${item.id}/edit`)} class="font-medium hover:underline">
	{item.name}
</a>
