<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button/index.js';
	import AdminOrganizationsTable from '$lib/components/admin/admin-organizations-table.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<main class="mx-auto mt-16 max-w-4xl px-4">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-xl font-semibold">Admin</h1>
		<Button href={resolve('/admin/clients/new')}>Create client</Button>
	</div>

	<AdminOrganizationsTable organizations={data.organizations} />
</main>
