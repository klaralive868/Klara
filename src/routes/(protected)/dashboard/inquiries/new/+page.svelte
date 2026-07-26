<script lang="ts">
	import SiteHeader from '$lib/components/site-header.svelte';
	import InquiryForm from '$lib/components/bookings/InquiryForm.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<SiteHeader title="Log inquiry" />
<div class="@container/main flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
	<div class="max-w-lg">
		<InquiryForm customers={data.customers} />
	</div>
</div>
