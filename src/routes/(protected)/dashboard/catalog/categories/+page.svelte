<script lang="ts">
	import SiteHeader from '$lib/components/site-header.svelte';
	import CategoryManager from '$lib/components/catalog/CategoryManager.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<SiteHeader title="Categories" />
<div class="@container/main flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
	<div class="max-w-lg">
		<CategoryManager categories={data.categories} message={form?.message} />
	</div>
</div>
