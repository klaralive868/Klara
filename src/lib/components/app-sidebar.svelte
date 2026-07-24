<script lang="ts">
	import DashboardIcon from '@tabler/icons-svelte/icons/dashboard';
	import InnerShadowTopIcon from '@tabler/icons-svelte/icons/inner-shadow-top';
	import ListIcon from '@tabler/icons-svelte/icons/list';
	import PlusIcon from '@tabler/icons-svelte/icons/plus';
	import ShieldIcon from '@tabler/icons-svelte/icons/shield';
	import TagIcon from '@tabler/icons-svelte/icons/tag';
	import UsersIcon from '@tabler/icons-svelte/icons/users';
	import { resolve } from '$app/paths';
	import NavDocuments from './nav-documents.svelte';
	import NavSecondary from './nav-secondary.svelte';
	import NavUser from './nav-user.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import type { ComponentProps } from 'svelte';

	let {
		email,
		isOperator,
		...restProps
	}: { email: string; isOperator: boolean } & ComponentProps<typeof Sidebar.Root> = $props();

	const dashboard = [
		{
			name: 'Overview',
			url: resolve('/dashboard'),
			icon: DashboardIcon
		},
		{
			name: 'Team',
			url: resolve('/dashboard/team'),
			icon: UsersIcon
		}
	];

	const catalog = [
		{
			name: 'All items',
			url: resolve('/dashboard/catalog'),
			icon: ListIcon
		},
		{
			name: 'Categories',
			url: resolve('/dashboard/catalog/categories'),
			icon: TagIcon
		},
		{
			name: 'New item',
			url: resolve('/dashboard/catalog/new'),
			icon: PlusIcon
		}
	];

	const navSecondary = $derived(
		isOperator ? [{ title: 'Admin', url: resolve('/admin'), icon: ShieldIcon }] : []
	);
</script>

<Sidebar.Root collapsible="offcanvas" {...restProps}>
	<Sidebar.Header>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton class="data-[slot=sidebar-menu-button]:!p-1.5">
					{#snippet child({ props })}
						<a href={resolve('/dashboard')} {...props}>
							<InnerShadowTopIcon class="!size-5" />
							<span class="text-base font-semibold">Klara</span>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Header>
	<Sidebar.Content>
		<NavDocuments items={dashboard} label="Dashboard" />
		<NavDocuments items={catalog} label="Catalog" />
		{#if navSecondary.length > 0}
			<NavSecondary items={navSecondary} class="mt-auto" />
		{/if}
	</Sidebar.Content>
	<Sidebar.Footer>
		<NavUser user={{ email }} />
	</Sidebar.Footer>
</Sidebar.Root>
