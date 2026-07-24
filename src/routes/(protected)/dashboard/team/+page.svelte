<script lang="ts">
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import SiteHeader from '$lib/components/site-header.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Field, FieldGroup, FieldLabel, FieldError } from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const id = $props.id();
</script>

<Sidebar.Provider
	style="--sidebar-width: calc(var(--spacing) * 72); --header-height: calc(var(--spacing) * 12);"
>
	<AppSidebar variant="inset" email={data.user?.email ?? ''} isOperator={data.isOperator} />
	<Sidebar.Inset>
		<SiteHeader title="Team" />
		<div class="@container/main flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
			<Card.Root>
				<Card.Header>
					<Card.Title>Members</Card.Title>
					<Card.Description>People with access to this organization.</Card.Description>
				</Card.Header>
				<Card.Content>
					{#if data.members.length === 0}
						<p class="text-sm text-muted-foreground">No members yet.</p>
					{:else}
						<div class="overflow-hidden rounded-lg border">
							<table class="w-full text-sm">
								<thead class="bg-muted">
									<tr>
										<th class="px-4 py-2 text-start font-medium">Email</th>
										<th class="px-4 py-2 text-start font-medium">Role</th>
										<th class="px-4 py-2 text-start font-medium">Status</th>
									</tr>
								</thead>
								<tbody>
									{#each data.members as member (member.id)}
										<tr class="border-t">
											<td class="px-4 py-2">{member.email}</td>
											<td class="px-4 py-2 capitalize">{member.role}</td>
											<td class="px-4 py-2">
												<Badge variant={member.status === 'active' ? 'default' : 'outline'}>
													{member.status}
												</Badge>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root class="max-w-sm">
				<Card.Header>
					<Card.Title>Invite a teammate</Card.Title>
				</Card.Header>
				<Card.Content>
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
				</Card.Content>
			</Card.Root>
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
