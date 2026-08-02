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
	import CustomerCellName from './customer-cell-name.svelte';
	import CustomerCellSource from './customer-cell-source.svelte';
	import CustomerCellStatus from './customer-cell-status.svelte';
	import CustomerCellActions from './customer-cell-actions.svelte';
	import type { Customer, CustomerStatus } from '$lib/customers/types';
	import type { FieldDefinition } from '$lib/field-definitions/types';
	import {
		getCoreRowModel,
		getFilteredRowModel,
		type ColumnDef,
		type ColumnFiltersState
	} from '@tanstack/table-core';

	let {
		customers,
		fieldDefinitions
	}: { customers: Customer[]; fieldDefinitions: readonly FieldDefinition[] } = $props();

	// Client-side filtering on the already-loaded rows — same "fine for now,
	// revisit past ~500 rows" reasoning as Catalog's All items table.
	let searchText = $state('');
	let statusFilter = $state<Set<string>>(new Set());

	const columnFilters = $derived<ColumnFiltersState>([
		{ id: 'fullName', value: searchText },
		{ id: 'status', value: statusFilter }
	]);

	function facetFilterFn(
		row: { getValue: (columnId: string) => unknown },
		columnId: string,
		filterValue: Set<string>
	) {
		return filterValue.size === 0 || filterValue.has(row.getValue(columnId) as string);
	}

	function fieldValue(customer: Customer, def: FieldDefinition): unknown {
		return def.isCore
			? (customer as unknown as Record<string, unknown>)[def.fieldKey]
			: customer.customFields[def.fieldKey];
	}

	function formatFieldValue(value: unknown, def: FieldDefinition): string {
		if (value === null || value === undefined || value === '') return '';
		if (def.fieldType === 'boolean') return value ? 'Yes' : 'No';
		if (def.fieldType === 'multi_select') return Array.isArray(value) ? value.join(', ') : '';
		return String(value);
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
				formatFieldValue(fieldValue(row.original, def), def)
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
			}
		},
		getRowId: (row) => row.id,
		onColumnFiltersChange: () => {
			// Filters are driven by searchText/statusFilter above, not
			// table-internal setFilterValue calls — nothing to sync back.
		},
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel()
	});

	const statusOptions: { value: CustomerStatus; label: string }[] = [
		{ value: 'active', label: 'Active' },
		{ value: 'archived', label: 'Archived' }
	];
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
		{#if searchText || statusFilter.size > 0}
			<Button
				variant="ghost"
				size="sm"
				onclick={() => {
					searchText = '';
					statusFilter = new Set();
				}}
			>
				Reset
			</Button>
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
