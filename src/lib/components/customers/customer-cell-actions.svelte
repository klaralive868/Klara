<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { Customer } from '$lib/customers/types';

	let { customer }: { customer: Customer } = $props();
</script>

<div class="flex justify-end">
	<Button href={resolve(`/dashboard/customers/${customer.id}/edit`)} variant="ghost" size="sm">
		Edit
	</Button>
</div>
