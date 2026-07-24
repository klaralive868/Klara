<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { CatalogItemListRow } from '$lib/catalog/types';

	let { item }: { item: CatalogItemListRow } = $props();
</script>

<div class="flex justify-end">
	<Button href={resolve(`/dashboard/catalog/${item.id}/edit`)} variant="ghost" size="sm">
		Edit
	</Button>
	<!-- TODO: add analytics action once Analytics module exists -->
</div>
