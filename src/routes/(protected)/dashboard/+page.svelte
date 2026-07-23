<script lang="ts">
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import SiteHeader from '$lib/components/site-header.svelte';
	import SectionCards from '$lib/components/section-cards.svelte';
	import ChartAreaInteractive from '$lib/components/chart-area-interactive.svelte';
	import DataTable from '$lib/components/data-table.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Field, FieldGroup, FieldLabel, FieldError } from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import tableData from './data.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const id = $props.id();
</script>

<Sidebar.Provider
	style="--sidebar-width: calc(var(--spacing) * 72); --header-height: calc(var(--spacing) * 12);"
>
	<AppSidebar variant="inset" email={data.user?.email ?? ''} isOperator={data.isOperator} />
	<Sidebar.Inset>
		<SiteHeader title="Dashboard" />
		<div class="flex flex-1 flex-col">
			<div class="@container/main flex flex-1 flex-col gap-2">
				<div class="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
					<SectionCards />
					<div class="px-4 lg:px-6">
						<ChartAreaInteractive />
					</div>
					<DataTable data={tableData} />
				</div>
			</div>
		</div>

		<div class="mx-auto w-full max-w-sm px-4 py-10">
			<h2 class="mb-4 text-lg font-semibold">Invite a teammate</h2>

			<form method="POST" action="?/invite">
				<FieldGroup>
					<Field>
						<FieldLabel for="invite-email-{id}">Email</FieldLabel>
						<Input id="invite-email-{id}" name="email" type="email" required />
					</Field>

					<Field>
						<FieldLabel for="invite-role-{id}">Role</FieldLabel>
						<select
							id="invite-role-{id}"
							name="role"
							required
							class="h-9 w-full rounded-3xl border border-input bg-transparent px-3 text-sm"
						>
							<option value="staff">Staff</option>
							<option value="manager">Manager</option>
							<option value="owner">Owner</option>
						</select>
					</Field>

					{#if form?.inviteMessage}
						{#if form.success}
							<p class="text-sm font-normal text-green-700" role="status">
								{form.inviteMessage}
							</p>
						{:else}
							<FieldError errors={[{ message: form.inviteMessage }]} />
						{/if}
					{/if}

					<Field>
						<Button type="submit">Send invite</Button>
					</Field>
				</FieldGroup>
			</form>
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
