<script lang="ts">
	import { enhance } from '$app/forms';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Field, FieldGroup, FieldLabel } from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import type { FieldsForManagement, FieldType } from '$lib/field-definitions/types';

	// Shared "manage fields" UI (ADR-0011) — reused by every entity_type
	// that adopts this system. Expects three named form actions to exist on
	// whatever route hosts it: ?/toggleCoreField, ?/toggleCustomField,
	// ?/addCustomField — each entity_type's own +page.server.ts implements
	// these by calling the shared functions in $lib/server/field-definitions
	// with its own entity_type baked in, so this component never needs to
	// know which module it's rendered under.
	let { data, message }: { data: FieldsForManagement; message?: string } = $props();

	const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
		{ value: 'text', label: 'Text' },
		{ value: 'number', label: 'Number' },
		{ value: 'date', label: 'Date' },
		{ value: 'select', label: 'Select (one option)' },
		{ value: 'multi_select', label: 'Multi-select (several options)' },
		{ value: 'boolean', label: 'Yes / No' }
	];

	let newFieldType = $state<FieldType>('text');
	let needsOptions = $derived(newFieldType === 'select' || newFieldType === 'multi_select');
	// Checkbox is not a native <input type="checkbox"> (bits-ui button-based),
	// so it never participates in FormData submission on its own — same
	// hidden-input convention as CatalogItemForm's unlimitedStock checkbox.
	let newFieldRequired = $state(false);
</script>

<div class="max-w-2xl space-y-8">
	{#if message}
		<p class="text-sm text-muted-foreground" role="status">{message}</p>
	{/if}

	{#if data.coreFields.length > 0}
	<section class="space-y-3">
		<h2 class="text-sm font-medium">Core fields</h2>
		<div class="overflow-hidden rounded-lg border">
			<Table.Root>
				<Table.Body>
					{#each data.coreFields as field (field.fieldKey)}
						<Table.Row>
							<Table.Cell class="font-medium">{field.label}</Table.Cell>
							<Table.Cell class="w-24 text-right">
								<form
									method="POST"
									action="?/toggleCoreField"
									use:enhance
									class="flex justify-end"
								>
									<input type="hidden" name="fieldKey" value={field.fieldKey} />
									<input type="hidden" name="active" value={(!field.active).toString()} />
									<Button type="submit" size="sm" variant={field.active ? 'outline' : 'default'}>
										{field.active ? 'Hide' : 'Show'}
									</Button>
								</form>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
	</section>
	{/if}

	<section class="space-y-3">
		<h2 class="text-sm font-medium">Custom fields</h2>
		<div class="overflow-hidden rounded-lg border">
			<Table.Root>
				<Table.Body>
					{#if data.activeCustomFields.length === 0 && data.inactiveCustomFields.length === 0}
						<Table.Row>
							<Table.Cell class="text-center text-muted-foreground">
								No custom fields yet.
							</Table.Cell>
						</Table.Row>
					{/if}
					{#each data.activeCustomFields as field (field.id)}
						<Table.Row>
							<Table.Cell class="font-medium">
								{field.label}
								{#if field.required}<span class="text-muted-foreground"> · required</span>{/if}
							</Table.Cell>
							<Table.Cell class="w-24 text-right">
								<form method="POST" action="?/toggleCustomField" use:enhance class="flex justify-end">
									<input type="hidden" name="fieldId" value={field.id} />
									<input type="hidden" name="active" value="false" />
									<Button type="submit" size="sm" variant="outline">Hide</Button>
								</form>
							</Table.Cell>
						</Table.Row>
					{/each}
					{#each data.inactiveCustomFields as field (field.id)}
						<Table.Row>
							<Table.Cell class="font-medium text-muted-foreground">
								{field.label} <Badge variant="outline">Hidden</Badge>
							</Table.Cell>
							<Table.Cell class="w-24 text-right">
								<form method="POST" action="?/toggleCustomField" use:enhance class="flex justify-end">
									<input type="hidden" name="fieldId" value={field.id} />
									<input type="hidden" name="active" value="true" />
									<Button type="submit" size="sm">Show</Button>
								</form>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
	</section>

	<section class="space-y-3">
		<h2 class="text-sm font-medium">Add a custom field</h2>
		<form method="POST" action="?/addCustomField" use:enhance class="space-y-4">
			<FieldGroup>
				<Field>
					<FieldLabel for="label">Field name</FieldLabel>
					<Input id="label" name="label" required />
				</Field>

				<Field>
					<FieldLabel for="fieldType">Type</FieldLabel>
					<select
						id="fieldType"
						name="fieldType"
						bind:value={newFieldType}
						class="h-9 w-full rounded-3xl border border-input bg-transparent px-3 text-sm"
					>
						{#each FIELD_TYPE_OPTIONS as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</Field>

				{#if needsOptions}
					<Field>
						<FieldLabel for="options">Options (comma-separated)</FieldLabel>
						<Input id="options" name="options" placeholder="Alex, Sam, Jordan" required />
					</Field>
				{/if}

				<input type="hidden" name="required" value={newFieldRequired} />
				<Field orientation="horizontal">
					<Checkbox id="required-checkbox" bind:checked={newFieldRequired} />
					<FieldLabel for="required-checkbox" class="font-normal">Required</FieldLabel>
				</Field>
			</FieldGroup>

			<Button type="submit">Add field</Button>
		</form>
	</section>
</div>
