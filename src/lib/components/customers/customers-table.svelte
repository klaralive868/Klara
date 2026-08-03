<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import {
		FlexRender,
		renderComponent,
		createSvelteTable
	} from '$lib/components/ui/data-table/index.js';
	import DataTableFacetedFilter from '../catalog/data-table-faceted-filter.svelte';
	import DynamicFieldFilterControls from '$lib/components/field-definitions/DynamicFieldFilterControls.svelte';
	import CustomerCellName from './customer-cell-name.svelte';
	import CustomerCellSource from './customer-cell-source.svelte';
	import CustomerCellStatus from './customer-cell-status.svelte';
	import CustomerCellActions from './customer-cell-actions.svelte';
	import type { Customer, CustomerStatus } from '$lib/customers/types';
	import type { FieldDefinition } from '$lib/field-definitions/types';
	import {
		fieldValue,
		formatFieldValue,
		isSortableFieldType,
		isDynamicFilterValueActive,
		numberRangeFilterFn,
		dateRangeFilterFn,
		facetFilterFn as dynamicFacetFilterFn,
		multiSelectFacetFilterFn,
		textIncludesFilterFn
	} from '$lib/field-definitions/table-columns';
	import {
		getCoreRowModel,
		getFilteredRowModel,
		getSortedRowModel,
		type ColumnDef,
		type ColumnFiltersState,
		type SortingState
	} from '@tanstack/table-core';

	let {
		customers,
		fieldDefinitions
	}: { customers: Customer[]; fieldDefinitions: readonly FieldDefinition[] } = $props();

	// Client-side sorting/filtering on the already-loaded rows — same
	// "fine for now, revisit past ~500 rows" reasoning as Catalog's All
	// items table (ADR-0011: no server-side query work this pass).
	let searchText = $state('');
	let statusFilter = $state<Set<string>>(new Set());
	let sorting = $state<SortingState>([]);
	let dynamicFilters = $state<ColumnFiltersState>([]);
	let dynamicFilterControls: DynamicFieldFilterControls | undefined = $state();

	const columnFilters = $derived<ColumnFiltersState>([
		{ id: 'fullName', value: searchText },
		{ id: 'status', value: statusFilter },
		...dynamicFilters
	]);

	function facetFilterFn(
		row: { getValue: (columnId: string) => unknown },
		columnId: string,
		filterValue: Set<string>
	) {
		return filterValue.size === 0 || filterValue.has(row.getValue(columnId) as string);
	}

	function dynamicFilterFnFor(def: FieldDefinition) {
		if (def.fieldType === 'number') return numberRangeFilterFn;
		if (def.fieldType === 'date') return dateRangeFilterFn;
		if (def.fieldType === 'multi_select') return multiSelectFacetFilterFn;
		if (def.fieldType === 'select' || def.fieldType === 'boolean') return dynamicFacetFilterFn;
		return textIncludesFilterFn;
	}

	// Every active field definition (core — email/phone if turned on — and
	// custom alike) becomes its own column, dynamically, instead of two
	// hardcoded Email/Phone columns. A field an org hasn't turned on simply
	// doesn't produce a column at all — the point of the toggle (ADR-0011).
	const dynamicColumns: ColumnDef<Customer>[] = $derived(
		fieldDefinitions.map((def) => ({
			id: def.fieldKey,
			header: def.label,
			accessorFn: (row: Customer) => fieldValue(row, def),
			cell: ({ row }: { row: { original: Customer } }) =>
				formatFieldValue(fieldValue(row.original, def), def),
			enableSorting: isSortableFieldType(def),
			filterFn: dynamicFilterFnFor(def)
		}))
	);

	const columns: ColumnDef<Customer>[] = $derived([
		{
			accessorKey: 'fullName',
			header: 'Name',
			filterFn: 'includesString',
			cell: ({ row }) => renderComponent(CustomerCellName, { customer: row.original })
		},
		...dynamicColumns,
		{
			accessorKey: 'source',
			header: 'Source',
			cell: ({ row }) => renderComponent(CustomerCellSource, { source: row.original.source })
		},
		{
			accessorKey: 'status',
			header: 'Status',
			filterFn: facetFilterFn,
			cell: ({ row }) => renderComponent(CustomerCellStatus, { status: row.original.status })
		},
		{
			id: 'actions',
			header: '',
			enableHiding: false,
			enableSorting: false,
			cell: ({ row }) => renderComponent(CustomerCellActions, { customer: row.original })
		}
	]);

	const table = createSvelteTable({
		get data() {
			return customers;
		},
		get columns() {
			return columns;
		},
		state: {
			get columnFilters() {
				return columnFilters;
			},
			get sorting() {
				return sorting;
			}
		},
		getRowId: (row) => row.id,
		onColumnFiltersChange: () => {
			// Filters are driven by searchText/statusFilter/dynamicFilters above,
			// not table-internal setFilterValue calls — nothing to sync back.
		},
		onSortingChange: (updater) => {
			sorting = typeof updater === 'function' ? updater(sorting) : updater;
		},
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel()
	});

	const statusOptions: { value: CustomerStatus; label: string }[] = [
		{ value: 'active', label: 'Active' },
		{ value: 'archived', label: 'Archived' }
	];

	const anyFilterActive = $derived(
		Boolean(searchText) ||
			statusFilter.size > 0 ||
			dynamicFilters.some((f) => isDynamicFilterValueActive(f.value))
	);

	function resetFilters() {
		searchText = '';
		statusFilter = new Set();
		dynamicFilterControls?.reset();
	}
</script>

<div class="space-y-4">
	<div class="flex flex-wrap items-center gap-2">
		<Input
			placeholder="Search by name…"
			bind:value={searchText}
			class="h-9 w-full sm:w-64"
			aria-label="Search customers by name"
		/>
		<DataTableFacetedFilter title="Status" options={statusOptions} bind:selected={statusFilter} />
		<DynamicFieldFilterControls
			bind:this={dynamicFilterControls}
			definitions={fieldDefinitions}
			bind:filters={dynamicFilters}
		/>
		{#if anyFilterActive}
			<Button variant="ghost" size="sm" onclick={resetFilters}>Reset</Button>
		{/if}
	</div>

	<div class="overflow-hidden rounded-lg border">
		<Table.Root>
			<Table.Header class="bg-muted">
				{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
					<Table.Row>
						{#each headerGroup.headers as header (header.id)}
							<Table.Head>
								{#if !header.isPlaceholder}
									{#if header.column.getCanSort()}
										<button
											type="button"
											class="flex items-center gap-1 select-none"
											onclick={header.column.getToggleSortingHandler()}
										>
											<FlexRender
												content={header.column.columnDef.header}
												context={header.getContext()}
											/>
											{#if header.column.getIsSorted() === 'asc'}
												<span aria-hidden="true">↑</span>
											{:else if header.column.getIsSorted() === 'desc'}
												<span aria-hidden="true">↓</span>
											{/if}
										</button>
									{:else}
										<FlexRender
											content={header.column.columnDef.header}
											context={header.getContext()}
										/>
									{/if}
								{/if}
							</Table.Head>
						{/each}
					</Table.Row>
				{/each}
			</Table.Header>
			<Table.Body>
				{#if table.getRowModel().rows?.length}
					{#each table.getRowModel().rows as row (row.id)}
						<Table.Row>
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
							No customers found.
						</Table.Cell>
					</Table.Row>
				{/if}
			</Table.Body>
		</Table.Root>
	</div>
</div>
