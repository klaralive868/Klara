<script lang="ts">
	import SiteHeader from '$lib/components/site-header.svelte';
	import ResourceForm from '$lib/components/bookings/ResourceForm.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<SiteHeader title="Edit resource" />
<div class="@container/main flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
	<div class="max-w-lg">
		{#if form?.success}
			<p class="mb-4 text-sm font-normal text-green-700" role="status">{form.message}</p>
		{/if}

		<ResourceForm
			initial={data.resource}
			images={data.images}
			seatCounts={data.seatCounts}
			message={form?.success ? undefined : form?.message}
		/>
	</div>
</div>
