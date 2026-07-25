<script lang="ts">
	import SiteHeader from '$lib/components/site-header.svelte';
	import ResourceForm from '$lib/components/bookings/ResourceForm.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<SiteHeader title="Add resource" />
<div class="@container/main flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
	<div class="max-w-lg">
		<ResourceForm message={form?.message} />
	</div>
</div>
