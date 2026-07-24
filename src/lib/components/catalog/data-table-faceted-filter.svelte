<script lang="ts">
	import PlusCircleIcon from '@lucide/svelte/icons/circle-plus';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';

	let {
		title,
		options,
		selected = $bindable(new Set())
	}: {
		title: string;
		options: readonly { value: string; label: string }[];
		selected?: Set<string>;
	} = $props();

	let open = $state(false);

	function toggle(value: string) {
		const next = new Set(selected);
		if (next.has(value)) {
			next.delete(value);
		} else {
			next.add(value);
		}
		selected = next;
	}

	function clear() {
		selected = new Set();
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="outline" size="sm" class="border-dashed">
				<PlusCircleIcon />
				{title}
				{#if selected.size > 0}
					<Separator orientation="vertical" class="mx-2 h-4" />
					<Badge variant="secondary" class="rounded-sm lg:hidden">
						{selected.size}
					</Badge>
					<div class="hidden gap-1 lg:flex">
						{#if selected.size > 2}
							<Badge variant="secondary" class="rounded-sm">
								{selected.size} selected
							</Badge>
						{:else}
							{#each options.filter((o) => selected.has(o.value)) as option (option.value)}
								<Badge variant="secondary" class="rounded-sm">
									{option.label}
								</Badge>
							{/each}
						{/if}
					</div>
				{/if}
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-56 p-0" align="start">
		<Command.Root>
			<Command.Input placeholder={title} />
			<Command.List>
				<Command.Empty>No results found.</Command.Empty>
				<Command.Group>
					{#each options as option (option.value)}
						<Command.Item
							value={option.label}
							onSelect={() => toggle(option.value)}
							data-checked={selected.has(option.value)}
						>
							<span
								class="flex size-4 items-center justify-center rounded-sm border border-primary {selected.has(
									option.value
								)
									? 'bg-primary text-primary-foreground'
									: 'opacity-50'}"
							>
								{#if selected.has(option.value)}
									✓
								{/if}
							</span>
							<span>{option.label}</span>
						</Command.Item>
					{/each}
				</Command.Group>
				{#if selected.size > 0}
					<Command.Separator />
					<Command.Group>
						<Command.Item value="clear-filters" onSelect={clear} class="justify-center text-center">
							Clear filters
						</Command.Item>
					</Command.Group>
				{/if}
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
