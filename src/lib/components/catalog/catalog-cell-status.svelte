<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import type { CatalogItemStatus } from '$lib/catalog/types';

	let { status }: { status: CatalogItemStatus } = $props();

	const variant = $derived(
		status === 'published' ? 'default' : status === 'archived' ? 'secondary' : 'outline'
	);
</script>

<Badge {variant} class="capitalize">{status}</Badge>
