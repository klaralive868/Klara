<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import type { Icon } from '@tabler/icons-svelte';

	let { items, label }: { items: { name: string; url: string; icon: Icon }[]; label: string } =
		$props();
</script>

<Sidebar.Group class="group-data-[collapsible=icon]:hidden">
	<Sidebar.GroupLabel>{label}</Sidebar.GroupLabel>
	<Sidebar.Menu>
		{#each items as item (item.name)}
			<Sidebar.MenuItem>
				<Sidebar.MenuButton>
					{#snippet child({ props })}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- item.url is pre-resolved via resolve() by the caller -->
						<a {...props} href={item.url}>
							<item.icon />
							<span>{item.name}</span>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		{/each}
	</Sidebar.Menu>
</Sidebar.Group>
