<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Customer } from '$lib/customers/types';

	let { customer }: { customer: Customer } = $props();
</script>

<a href={resolve(`/dashboard/customers/${customer.id}/edit`)} class="font-medium hover:underline">
	{customer.fullName}
</a>
