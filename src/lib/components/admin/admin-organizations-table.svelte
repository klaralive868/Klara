<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import type { AdminOrganizationRow } from '$lib/admin/types';

	let { organizations }: { organizations: AdminOrganizationRow[] } = $props();

	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function statusLabel(status: AdminOrganizationRow['status']) {
		if (status === 'active') return 'Active';
		if (status === 'pending') return 'Invited / pending setup';
		return 'No owner';
	}

	function statusVariant(status: AdminOrganizationRow['status']) {
		if (status === 'active') return 'default';
		if (status === 'pending') return 'outline';
		return 'destructive';
	}
</script>

<div class="overflow-hidden rounded-lg border">
	<Table.Root>
		<Table.Header class="bg-muted">
			<Table.Row>
				<Table.Head>Name</Table.Head>
				<Table.Head>Owner email</Table.Head>
				<Table.Head>Status</Table.Head>
				<Table.Head>Created</Table.Head>
				<Table.Head>Members</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#if organizations.length > 0}
				{#each organizations as org (org.id)}
					<Table.Row>
						<Table.Cell class="font-medium">{org.name}</Table.Cell>
						<Table.Cell>{org.ownerEmail ?? '—'}</Table.Cell>
						<Table.Cell>
							<Badge variant={statusVariant(org.status)}>{statusLabel(org.status)}</Badge>
						</Table.Cell>
						<Table.Cell>{formatDate(org.createdAt)}</Table.Cell>
						<Table.Cell>{org.memberCount}</Table.Cell>
					</Table.Row>
				{/each}
			{:else}
				<Table.Row>
					<Table.Cell colspan={5} class="h-24 text-center text-muted-foreground">
						No organizations yet.
					</Table.Cell>
				</Table.Row>
			{/if}
		</Table.Body>
	</Table.Root>
</div>
