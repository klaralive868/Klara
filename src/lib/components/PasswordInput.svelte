<script lang="ts">
	import EyeIcon from '@lucide/svelte/icons/eye';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';

	interface Props {
		id: string;
		name: string;
		value?: string;
		autocomplete?: 'current-password' | 'new-password';
		required?: boolean;
		minlength?: number;
	}

	let {
		id,
		name,
		value = $bindable(''),
		autocomplete = 'current-password',
		required = true,
		minlength
	}: Props = $props();

	let visible = $state(false);
</script>

<div class="relative">
	<Input
		{id}
		{name}
		{required}
		{minlength}
		{autocomplete}
		type={visible ? 'text' : 'password'}
		bind:value
		class="pr-10"
	/>
	<Button
		type="button"
		variant="ghost"
		size="icon-sm"
		onclick={() => (visible = !visible)}
		aria-label={visible ? 'Hide password' : 'Show password'}
		aria-pressed={visible}
		class="absolute inset-y-0 right-1 my-auto"
	>
		{#if visible}
			<EyeOffIcon class="size-4" />
		{:else}
			<EyeIcon class="size-4" />
		{/if}
	</Button>
</div>
