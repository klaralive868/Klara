<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import type { CustomerStatus } from '$lib/customers/types';

	let { status }: { status: CustomerStatus } = $props();

	const variant = $derived(status === 'active' ? 'default' : 'secondary');
</script>

<Badge {variant} class="capitalize">{status}</Badge>
