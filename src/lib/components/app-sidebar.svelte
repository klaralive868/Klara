<script lang="ts">
	import AddressBookIcon from '@tabler/icons-svelte/icons/address-book';
	import CalendarEventIcon from '@tabler/icons-svelte/icons/calendar-event';
	import InnerShadowTopIcon from '@tabler/icons-svelte/icons/inner-shadow-top';
	import ListIcon from '@tabler/icons-svelte/icons/list';
	import MessageCircleQuestionIcon from '@tabler/icons-svelte/icons/message-circle-question';
	import PackageIcon from '@tabler/icons-svelte/icons/package';
	import PlusIcon from '@tabler/icons-svelte/icons/plus';
	import SettingsIcon from '@tabler/icons-svelte/icons/settings';
	import ShieldIcon from '@tabler/icons-svelte/icons/shield';
	import ShoppingCartIcon from '@tabler/icons-svelte/icons/shopping-cart';
	import TagIcon from '@tabler/icons-svelte/icons/tag';
	import UserPlusIcon from '@tabler/icons-svelte/icons/user-plus';
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
		enabledModules,
		showOrgSections = true,
		...restProps
	}: {
		email: string;
		isOperator: boolean;
		enabledModules: string[];
		// The (admin) area has no organization context to speak of — an
		// operator isn't ordinarily a member of any client org (ADR-0003) — so
		// "Dashboard" and "Customers" (org-scoped, unconditional otherwise)
		// would link to routes that just bounce them back out. False for that
		// shell; true (default) everywhere else, unchanged.
		showOrgSections?: boolean;
	} & ComponentProps<typeof Sidebar.Root> = $props();

	const dashboard = [
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

	const orders = [
		{
			name: 'All orders',
			url: resolve('/dashboard/orders'),
			icon: ShoppingCartIcon
		},
		{
			name: 'Fields',
			url: resolve('/dashboard/orders/fields'),
			icon: SettingsIcon
		}
	];

	const customers = [
		{
			name: 'All customers',
			url: resolve('/dashboard/customers'),
			icon: AddressBookIcon
		},
		{
			name: 'New customer',
			url: resolve('/dashboard/customers/new'),
			icon: UserPlusIcon
		},
		{
			name: 'Fields',
			url: resolve('/dashboard/customers/fields'),
			icon: SettingsIcon
		}
	];

	const resources = [
		{
			name: 'All resources',
			url: resolve('/dashboard/resources'),
			icon: PackageIcon
		},
		{
			name: 'New resource',
			url: resolve('/dashboard/resources/new'),
			icon: PlusIcon
		}
	];

	const bookings = [
		{
			name: 'All bookings',
			url: resolve('/dashboard/bookings'),
			icon: CalendarEventIcon
		},
		{
			name: 'Log booking',
			url: resolve('/dashboard/bookings/new'),
			icon: PlusIcon
		}
	];

	const inquiries = [
		{
			name: 'All inquiries',
			url: resolve('/dashboard/inquiries'),
			icon: MessageCircleQuestionIcon
		},
		{
			name: 'Log inquiry',
			url: resolve('/dashboard/inquiries/new'),
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
		{#if showOrgSections}
			<NavDocuments items={dashboard} label="Dashboard" />
		{/if}
		{#if enabledModules.includes('catalog')}
			<NavDocuments items={catalog} label="Catalog" />
			<NavDocuments items={orders} label="Orders" />
		{/if}
		{#if showOrgSections}
			<NavDocuments items={customers} label="Customers" />
		{/if}
		{#if enabledModules.includes('resources')}
			<NavDocuments items={resources} label="Resources" />
		{/if}
		{#if enabledModules.includes('bookings')}
			<NavDocuments items={bookings} label="Bookings" />
		{/if}
		{#if enabledModules.includes('inquiries')}
			<NavDocuments items={inquiries} label="Travel Inquiries" />
		{/if}
		{#if navSecondary.length > 0}
			<NavSecondary items={navSecondary} class="mt-auto" />
		{/if}
	</Sidebar.Content>
	<Sidebar.Footer>
		<NavUser user={{ email }} />
	</Sidebar.Footer>
</Sidebar.Root>
