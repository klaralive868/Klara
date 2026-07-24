<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import {
		FlexRender,
		renderComponent,
		createSvelteTable
	} from '$lib/components/ui/data-table/index.js';
	import DataTableCheckbox from '$lib/components/data-table-checkbox.svelte';
	import DataTableFacetedFilter from './data-table-faceted-filter.svelte';
	import CatalogCellName from './catalog-cell-name.svelte';
	import CatalogCellMaterialType from './catalog-cell-material-type.svelte';
	import CatalogCellPrice from './catalog-cell-price.svelte';
	import CatalogCellStock from './catalog-cell-stock.svelte';
	import CatalogCellStatus from './catalog-cell-status.svelte';
	import CatalogCellActions from './catalog-cell-actions.svelte';
	import { MATERIAL_TYPES } from '$lib/catalog/material-types';
	import type { CatalogItemListRow, CatalogItemStatus } from '$lib/catalog/types';
	import {
		getCoreRowModel,
		getFilteredRowModel,
		type ColumnDef,
		type ColumnFiltersState,
		type RowSelectionState
	} from '@tanstack/table-core';

	let { items }: { items: CatalogItemListRow[] } = $props();

	// Client-side filtering on the already-loaded rows — fine at the catalog
	// sizes this app expects today. Revisit with server-side search/filter
	// (query params + a scoped Supabase query) if a single organization's
	// catalog grows past roughly 500 items and this starts feeling slow.
	let searchText = $state('');
	let materialTypeFilter = $state<Set<string>>(new Set());
	let statusFilter = $state<Set<string>>(new Set());
	let rowSelection = $state<RowSelectionState>({});

	const columnFilters = $derived<ColumnFiltersState>([
		{ id: 'name', value: searchText },
		{ id: 'materialType', value: materialTypeFilter },
		{ id: 'status', value: statusFilter }
	]);

	function facetFilterFn(
		row: { getValue: (columnId: string) => unknown },
		columnId: string,
		filterValue: Set<string>
	) {
		return !filterValue || filterValue.size === 0 || filterValue.has(row.getValue(columnId) as string);
	}

	const columns: ColumnDef<CatalogItemListRow>[] = [
		{
			id: 'select',
			header: ({ table }) =>
				renderComponent(DataTableCheckbox, {
					checked: table.getIsAllPageRowsSelected(),
					indeterminate: table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected(),
					onCheckedChange: (value: boolean) => table.toggleAllPageRowsSelected(!!value),
					'aria-label': 'Select all'
				}),
			cell: ({ row }) =>
				renderComponent(DataTableCheckbox, {
					checked: row.getIsSelected(),
					onCheckedChange: (value: boolean) => row.toggleSelected(!!value),
					'aria-label': 'Select row'
				}),
			enableSorting: false,
			enableHiding: false
		},
		{
			accessorKey: 'name',
			header: 'Name',
			filterFn: 'includesString',
			cell: ({ row }) => renderComponent(CatalogCellName, { item: row.original })
		},
		{
			accessorKey: 'materialType',
			header: 'Material type',
			filterFn: facetFilterFn,
			cell: ({ row }) =>
				renderComponent(CatalogCellMaterialType, { materialType: row.original.materialType })
		},
		{
			accessorKey: 'priceCents',
			header: 'Price',
			cell: ({ row }) => renderComponent(CatalogCellPrice, { priceCents: row.original.priceCents })
		},
		{
			id: 'stock',
			header: 'Stock',
			accessorFn: (row) => row.stockTotal,
			cell: ({ row }) =>
				renderComponent(CatalogCellStock, {
					stockBySize: row.original.stockBySize,
					stockTotal: row.original.stockTotal
				})
		},
		{
			accessorKey: 'status',
			header: 'Status',
			filterFn: facetFilterFn,
			cell: ({ row }) => renderComponent(CatalogCellStatus, { status: row.original.status })
		},
		{
			id: 'actions',
			header: '',
			enableHiding: false,
			cell: ({ row }) => renderComponent(CatalogCellActions, { item: row.original })
		}
	];

	const table = createSvelteTable({
		get data() {
			return items;
		},
		columns,
		state: {
			get columnFilters() {
				return columnFilters;
			},
			get rowSelection() {
				return rowSelection;
			}
		},
		getRowId: (row) => row.id,
		enableRowSelection: true,
		onColumnFiltersChange: () => {
			// Filters are driven by searchText/materialTypeFilter/statusFilter
			// above, not table-internal setFilterValue calls — nothing to sync
			// back.
		},
		onRowSelectionChange: (updater) => {
			rowSelection = typeof updater === 'function' ? updater(rowSelection) : updater;
		},
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel()
	});

	const selectedIds = $derived(table.getFilteredSelectedRowModel().rows.map((row) => row.original.id));

	const materialTypeOptions = MATERIAL_TYPES.map((type) => ({ value: type.key, label: type.label }));
	const statusOptions: { value: CatalogItemStatus; label: string }[] = [
		{ value: 'draft', label: 'Draft' },
		{ value: 'published', label: 'Published' },
		{ value: 'archived', label: 'Archived' }
	];

	let bulkStatus = $state<'published' | 'archived' | null>(null);
	let bulkFormEl = $state<HTMLFormElement | null>(null);
	let bulkMessage = $state<string | null>(null);
	let bulkPending = $state(false);

	async function requestBulkStatus(status: 'published' | 'archived') {
		bulkStatus = status;
		// $state writes are batched, not applied to the DOM synchronously — the
		// hidden <input value={bulkStatus}> below wouldn't reflect the new
		// status yet if requestSubmit() ran in the same tick, submitting
		// whatever the input's previous value was (empty, the first time).
		await tick();
		bulkFormEl?.requestSubmit();
	}
</script>

<div class="space-y-4">
	<div class="flex flex-wrap items-center gap-2">
		<Input
			placeholder="Search by name…"
			bind:value={searchText}
			class="h-9 w-full sm:w-64"
			aria-label="Search items by name"
		/>
		<DataTableFacetedFilter
			title="Material type"
			options={materialTypeOptions}
			bind:selected={materialTypeFilter}
		/>
		<DataTableFacetedFilter title="Status" options={statusOptions} bind:selected={statusFilter} />
		{#if searchText || materialTypeFilter.size > 0 || statusFilter.size > 0}
			<Button
				variant="ghost"
				size="sm"
				onclick={() => {
					searchText = '';
					materialTypeFilter = new Set();
					statusFilter = new Set();
				}}
			>
				Reset
			</Button>
		{/if}
	</div>

	{#if selectedIds.length > 0}
		<div class="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2">
			<span class="text-sm font-medium">{selectedIds.length} selected</span>
			<Button size="sm" disabled={bulkPending} onclick={() => requestBulkStatus('published')}>
				Publish
			</Button>
			<Button
				size="sm"
				variant="outline"
				disabled={bulkPending}
				onclick={() => requestBulkStatus('archived')}
			>
				Archive
			</Button>
		</div>
	{/if}

	{#if bulkMessage}
		<p class="text-sm text-muted-foreground" role="status">{bulkMessage}</p>
	{/if}

	<form
		bind:this={bulkFormEl}
		method="POST"
		action="?/bulkUpdateStatus"
		class="hidden"
		use:enhance={() => {
			bulkPending = true;
			return async ({ result, update }) => {
				bulkPending = false;
				if (result.type === 'success' || result.type === 'failure') {
					bulkMessage = (result.data?.bulkMessage as string | undefined) ?? null;
				}
				await update();
				if (result.type === 'success') {
					rowSelection = {};
				}
			};
		}}
	>
		{#each selectedIds as id (id)}
			<input type="hidden" name="itemIds" value={id} />
		{/each}
		<input type="hidden" name="status" value={bulkStatus ?? ''} />
	</form>

	<Tooltip.Provider>
		<div class="overflow-hidden rounded-lg border">
			<Table.Root>
				<Table.Header class="bg-muted">
					{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
						<Table.Row>
							{#each headerGroup.headers as header (header.id)}
								<Table.Head>
									{#if !header.isPlaceholder}
										<FlexRender
											content={header.column.columnDef.header}
											context={header.getContext()}
										/>
									{/if}
								</Table.Head>
							{/each}
						</Table.Row>
					{/each}
				</Table.Header>
				<Table.Body>
					{#if table.getRowModel().rows?.length}
						{#each table.getRowModel().rows as row (row.id)}
							<Table.Row data-state={row.getIsSelected() && 'selected'}>
								{#each row.getVisibleCells() as cell (cell.id)}
									<Table.Cell>
										<FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
									</Table.Cell>
								{/each}
							</Table.Row>
						{/each}
					{:else}
						<Table.Row>
							<Table.Cell colspan={columns.length} class="h-24 text-center text-muted-foreground">
								No items found.
							</Table.Cell>
						</Table.Row>
					{/if}
				</Table.Body>
			</Table.Root>
		</div>
	</Tooltip.Provider>
</div>
