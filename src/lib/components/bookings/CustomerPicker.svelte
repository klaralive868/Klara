<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Field, FieldGroup, FieldLabel } from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { PLACEHOLDER_CUSTOMERS, type PlaceholderCustomer } from '$lib/bookings/placeholder-customers';

	// Type the prop via the destructuring annotation, not an inline generic
	// on $bindable() itself (`$bindable<T>(null)`) — that form silently
	// breaks two-way propagation to the parent in this Svelte version (the
	// child's own `{#if selected}` branch still reacts locally, which looks
	// like it's working, but the parent's bound variable never updates).
	// Matches the working pattern already used by CategoryTagger.svelte.
	let { selected = $bindable(null) }: { selected: PlaceholderCustomer | null } = $props();

	const id = $props.id();

	// A local, mutable copy — "create new" appends to this without touching
	// the shared placeholder module (same reasoning as any other static-UI
	// local-state list: nothing here persists past a page reload yet).
	let customers = $state([...PLACEHOLDER_CUSTOMERS]);
	let query = $state('');
	let showCreateForm = $state(false);

	let newName = $state('');
	let newEmail = $state('');
	let newPhone = $state('');

	const matches = $derived(
		query.trim()
			? customers.filter((customer) => {
					const needle = query.trim().toLowerCase();
					return (
						customer.fullName.toLowerCase().includes(needle) ||
						customer.email.toLowerCase().includes(needle)
					);
				})
			: customers
	);

	function select(customer: PlaceholderCustomer) {
		selected = customer;
		query = '';
		showCreateForm = false;
	}

	function change() {
		selected = null;
	}

	function createCustomer() {
		if (!newName.trim() || !newEmail.trim()) return;
		const customer: PlaceholderCustomer = {
			id: `new-${Date.now()}`,
			fullName: newName.trim(),
			email: newEmail.trim(),
			phone: newPhone.trim()
		};
		customers = [...customers, customer];
		select(customer);
		newName = '';
		newEmail = '';
		newPhone = '';
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
				<Button type="button" onclick={createCustomer}>Add customer</Button>
			</FieldGroup>
		{/if}
	</div>
{/if}
