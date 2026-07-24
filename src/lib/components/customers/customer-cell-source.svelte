<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import type { CustomerSource } from '$lib/customers/types';

	let { source }: { source: CustomerSource } = $props();

	const variant = $derived(
		source === 'booking' ? 'default' : source === 'import' ? 'secondary' : 'outline'
	);
</script>

<Badge {variant} class="capitalize">{source}</Badge>
