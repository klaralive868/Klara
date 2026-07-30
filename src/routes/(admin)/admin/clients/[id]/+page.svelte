<script lang="ts">
	import { untrack } from 'svelte';
	import SiteHeader from '$lib/components/site-header.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import {
		Field,
		FieldGroup,
		FieldLabel,
		FieldError,
		FieldDescription
	} from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const id = $props.id();

	// Mirrors the 4 modules app-sidebar.svelte gates on — not imported from
	// $lib/server/client-modules since that module is server-only and can't
	// be pulled into a .svelte file.
	const MODULE_NAMES = ['catalog', 'bookings', 'resources', 'inquiries'] as const;

	const moduleByName = $derived(new Map(data.modules.map((row) => [row.module, row.tier])));

	// Seeded once from the loaded rows, same "capture initial, don't re-sync
	// on prop changes" convention as ResourceForm/CatalogItemForm — the user
	// is editing local checkbox state, not mirroring the server's.
	let checkedByModule = $state(
		untrack(() => Object.fromEntries(MODULE_NAMES.map((m) => [m, moduleByName.has(m)])))
	) as Record<(typeof MODULE_NAMES)[number], boolean>;
	let catalogTier = $state(untrack(() => moduleByName.get('catalog') ?? 'clothing'));
</script>

<SiteHeader title={data.organization.name} />
<div class="@container/main flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
	<div class="max-w-lg">
		<div class="mb-6 flex items-start justify-between">
			<p class="font-mono text-sm text-muted-foreground">{data.organization.slug}</p>
			<Badge variant={data.organization.archived ? 'destructive' : 'default'}>
				{data.organization.archived ? 'Deactivated' : 'Active'}
			</Badge>
		</div>

		<p class="mb-8 text-sm text-muted-foreground">
			Owner: {data.organization.ownerEmail ?? '—'}
		</p>

		{#if form?.message && !form?.success}
			<div class="mb-6">
				<FieldError errors={[{ message: form.message }]} />
			</div>
		{/if}
		{#if form?.success}
			<p class="mb-6 text-sm text-muted-foreground" role="status">{form.message}</p>
		{/if}

		<form method="POST" action="?/updateModules" class="space-y-6">
			<h2 class="text-sm font-medium">Modules</h2>
			<FieldGroup>
				<Field>
					<input type="hidden" name="catalog" value={checkedByModule.catalog} />
					<div class="flex items-center gap-2">
						<Checkbox id="catalog-{id}" bind:checked={checkedByModule.catalog} />
						<FieldLabel for="catalog-{id}">Catalog</FieldLabel>
					</div>
				</Field>

				{#if checkedByModule.catalog}
					<Field>
						<FieldLabel for="catalogTier-{id}">Catalog tier</FieldLabel>
						<Input id="catalogTier-{id}" name="catalogTier" bind:value={catalogTier} required />
						<FieldDescription
							>The registry this organization's catalog uses (e.g. "clothing").</FieldDescription
						>
					</Field>
				{/if}

				<Field>
					<input type="hidden" name="bookings" value={checkedByModule.bookings} />
					<div class="flex items-center gap-2">
						<Checkbox id="bookings-{id}" bind:checked={checkedByModule.bookings} />
						<FieldLabel for="bookings-{id}">Bookings</FieldLabel>
					</div>
				</Field>

				<Field>
					<input type="hidden" name="resources" value={checkedByModule.resources} />
					<div class="flex items-center gap-2">
						<Checkbox id="resources-{id}" bind:checked={checkedByModule.resources} />
						<FieldLabel for="resources-{id}">Resources</FieldLabel>
					</div>
				</Field>

				<Field>
					<input type="hidden" name="inquiries" value={checkedByModule.inquiries} />
					<div class="flex items-center gap-2">
						<Checkbox id="inquiries-{id}" bind:checked={checkedByModule.inquiries} />
						<FieldLabel for="inquiries-{id}">Inquiries</FieldLabel>
					</div>
				</Field>
			</FieldGroup>

			<Field>
				<Button type="submit">Save modules</Button>
			</Field>
		</form>

		<div class="mt-10 border-t pt-6">
			{#if data.organization.archived}
				<form method="POST" action="?/unarchive">
					<Button type="submit" variant="outline">Reactivate organization</Button>
				</form>
			{:else}
				<AlertDialog.Root>
					<AlertDialog.Trigger>
						{#snippet child({ props })}
							<Button {...props} variant="destructive">Deactivate organization</Button>
						{/snippet}
					</AlertDialog.Trigger>
					<AlertDialog.Content>
						<AlertDialog.Header>
							<AlertDialog.Title>Deactivate {data.organization.name}?</AlertDialog.Title>
							<AlertDialog.Description>
								Their team will immediately lose access to the dashboard. Nothing is deleted — this
								can be undone by reactivating the organization later.
							</AlertDialog.Description>
						</AlertDialog.Header>
						<AlertDialog.Footer>
							<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
							<form method="POST" action="?/archive">
								<AlertDialog.Action type="submit" variant="destructive">
									Deactivate
								</AlertDialog.Action>
							</form>
						</AlertDialog.Footer>
					</AlertDialog.Content>
				</AlertDialog.Root>
			{/if}
		</div>
	</div>
</div>
