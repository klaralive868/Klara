<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Field, FieldGroup, FieldLabel, FieldError } from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { CUSTOMER_EMAIL_PATTERN, type Customer } from '$lib/customers/types';

	let {
		customers,
		selected = $bindable(null)
	}: { customers: Customer[]; selected: Customer | null } = $props();

	const id = $props.id();

	// Newly-created customers land here so they show up in the list/selection
	// immediately without a full page reload — `customers` itself is a prop
	// owned by the parent load, not mutated in place.
	let createdCustomers = $state<Customer[]>([]);
	let query = $state('');
	let showCreateForm = $state(false);

	let newName = $state('');
	let newEmail = $state('');
	let newPhone = $state('');
	let createError = $state('');
	let creating = $state(false);

	const allCustomers = $derived([...customers, ...createdCustomers]);

	const matches = $derived(
		query.trim()
			? allCustomers.filter((customer) => {
					const needle = query.trim().toLowerCase();
					return (
						customer.fullName.toLowerCase().includes(needle) ||
						(customer.email ?? '').toLowerCase().includes(needle)
					);
				})
			: allCustomers
	);

	function select(customer: Customer) {
		selected = customer;
		query = '';
		showCreateForm = false;
	}

	function change() {
		selected = null;
	}

	async function createCustomer() {
		if (!newName.trim()) {
			createError = 'Enter a full name.';
			return;
		}
		if (!newEmail.trim() || !CUSTOMER_EMAIL_PATTERN.test(newEmail.trim())) {
			createError = 'Enter a valid email.';
			return;
		}
		createError = '';
		creating = true;

		try {
			const response = await fetch('/dashboard/customers/quick-create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					fullName: newName.trim(),
					email: newEmail.trim(),
					phone: newPhone.trim()
				})
			});
			const body = await response.json();

			if (!response.ok) {
				createError = body.error ?? 'Could not create the customer. Please try again.';
				return;
			}

			const customer = body.customer as Customer;
			createdCustomers = [...createdCustomers, customer];
			select(customer);
			newName = '';
			newEmail = '';
			newPhone = '';
		} catch {
			// A network failure or a non-JSON response (fetch() itself
			// rejecting, or response.json() failing to parse) never reaches
			// the !response.ok branch above — without this, the picker would
			// just silently stay in "creating" state forever with no
			// feedback at all.
			createError = 'Could not create the customer. Please check your connection and try again.';
		} finally {
			creating = false;
		}
	}
</script>

{#if selected}
	<div class="flex items-center justify-between rounded-lg border border-input px-3 py-2">
		<div>
			<p class="text-sm font-medium">{selected.fullName}</p>
			<p class="text-sm text-muted-foreground">{selected.email}</p>
		</div>
		<Button type="button" variant="outline" size="sm" onclick={change}>Change</Button>
	</div>
{:else}
	<div class="space-y-3">
		<Input
			placeholder="Search customers by name or email…"
			bind:value={query}
			aria-label="Search customers"
		/>

		<ul class="max-h-48 divide-y divide-border overflow-y-auto rounded-lg border border-input">
			{#each matches as customer (customer.id)}
				<li>
					<button
						type="button"
						class="w-full px-3 py-2 text-left text-sm hover:bg-muted"
						onclick={() => select(customer)}
					>
						<span class="font-medium">{customer.fullName}</span>
						<span class="text-muted-foreground"> · {customer.email}</span>
					</button>
				</li>
			{:else}
				<li class="px-3 py-2 text-sm text-muted-foreground">No matching customers.</li>
			{/each}
		</ul>

		{#if !showCreateForm}
			<Button type="button" variant="outline" onclick={() => (showCreateForm = true)}>
				+ Create new customer
			</Button>
		{:else}
			<FieldGroup>
				<Field>
					<FieldLabel for="newCustomerName-{id}">Full name</FieldLabel>
					<Input id="newCustomerName-{id}" bind:value={newName} />
				</Field>
				<Field>
					<FieldLabel for="newCustomerEmail-{id}">Email</FieldLabel>
					<Input id="newCustomerEmail-{id}" type="email" bind:value={newEmail} />
				</Field>
				<Field>
					<FieldLabel for="newCustomerPhone-{id}">Phone</FieldLabel>
					<Input id="newCustomerPhone-{id}" type="tel" bind:value={newPhone} />
				</Field>
				{#if createError}
					<FieldError errors={[{ message: createError }]} />
				{/if}
				<Button type="button" onclick={createCustomer} disabled={creating}>Add customer</Button>
			</FieldGroup>
		{/if}
	</div>
{/if}
