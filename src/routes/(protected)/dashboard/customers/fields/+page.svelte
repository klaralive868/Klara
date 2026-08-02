<script lang="ts">
	import SiteHeader from '$lib/components/site-header.svelte';
	import ManageFieldsPanel from '$lib/components/field-definitions/ManageFieldsPanel.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<SiteHeader title="Customer fields" />
<div class="@container/main flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
	<ManageFieldsPanel data={data.fields} message={form?.message} />
</div>
