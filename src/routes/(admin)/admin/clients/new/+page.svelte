<script lang="ts">
	import SiteHeader from '$lib/components/site-header.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		Field,
		FieldGroup,
		FieldLabel,
		FieldError,
		FieldDescription
	} from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { slugify } from '$lib/slug';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	const id = $props.id();

	let businessName = $state('');
	let slug = $state('');
	// Auto-derives the slug from the business name until the operator edits
	// the slug field themselves — once touched, their input always wins,
	// even if they then go back and change the business name again.
	let slugManuallyEdited = $state(false);

	$effect(() => {
		if (!slugManuallyEdited) {
			slug = slugify(businessName);
		}
	});
</script>

<SiteHeader title="Create client" />
<div class="@container/main flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
	<form method="POST" class="max-w-lg space-y-6">
		<FieldGroup>
			<Field>
				<FieldLabel for="businessName-{id}">Business name</FieldLabel>
				<Input id="businessName-{id}" name="businessName" bind:value={businessName} required />
			</Field>

			<Field>
				<FieldLabel for="slug-{id}">URL slug</FieldLabel>
				<Input
					id="slug-{id}"
					name="slug"
					bind:value={slug}
					oninput={() => (slugManuallyEdited = true)}
					required
				/>
				<FieldDescription>Used in the public URL for this client's pages.</FieldDescription>
			</Field>

			<Field>
				<FieldLabel for="ownerFullName-{id}">Owner full name</FieldLabel>
				<Input id="ownerFullName-{id}" name="ownerFullName" required />
			</Field>

			<Field>
				<FieldLabel for="ownerEmail-{id}">Owner email</FieldLabel>
				<Input id="ownerEmail-{id}" name="ownerEmail" type="email" required />
			</Field>
		</FieldGroup>

		{#if form?.message}
			<FieldError errors={[{ message: form.message }]} />
		{/if}

		<Field>
			<Button type="submit">Create client</Button>
		</Field>
	</form>
</div>
