<script lang="ts">
	import { resolve } from '$app/paths';
	import SiteHeader from '$lib/components/site-header.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import AdminOrganizationsTable from '$lib/components/admin/admin-organizations-table.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<SiteHeader title="Admin" />
<div class="@container/main flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
	<div class="flex items-center justify-end gap-2">
		<Button href={resolve('/admin/clients/new')}>Create client</Button>
	</div>

	<AdminOrganizationsTable organizations={data.organizations} />
</div>
