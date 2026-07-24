<script lang="ts">
	import SiteHeader from '$lib/components/site-header.svelte';
	import CustomerForm from '$lib/components/customers/CustomerForm.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<SiteHeader title="Edit customer" />
<div class="@container/main flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
	{#if form?.success}
		<p class="text-sm font-normal text-green-700" role="status">{form.message}</p>
	{/if}
	<CustomerForm
		initial={data.customer}
		fieldDefinitions={data.fieldDefinitions}
		message={form?.success ? undefined : form?.message}
	/>
</div>
