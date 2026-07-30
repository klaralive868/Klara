<script lang="ts">
	import { untrack } from 'svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import XIcon from '@lucide/svelte/icons/x';

	// A freeform repeatable-text chip input — no existing primitive for this
	// in the app (CategoryTagger.svelte is the closest relative, but it
	// toggles a fixed, pre-existing vocabulary rather than letting the user
	// type arbitrary new values). Submits as one hidden <input> per tag under
	// the same `name`, so a server action reads it back with
	// `formData.getAll(name)` — same multi-value-same-name convention
	// CategoryTagger already uses for its checkboxes.
	let {
		id,
		name,
		initial,
		placeholder = 'Add and press Enter'
	}: { id: string; name: string; initial?: string[]; placeholder?: string } = $props();

	// Captured once, like ResourceForm's other fields — editing local state,
	// not tracking the prop afterward.
	let tags = $state(untrack(() => [...(initial ?? [])]));
	let draft = $state('');

	function addDraft() {
		const value = draft.trim();
		if (value && !tags.includes(value)) {
			tags.push(value);
		}
		draft = '';
	}

	function removeTag(index: number) {
		tags.splice(index, 1);
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			addDraft();
		}
	}
</script>

{#each tags as tag (tag)}
	<input type="hidden" {name} value={tag} />
{/each}

<div class="flex flex-wrap gap-1.5">
	{#each tags as tag, index (tag)}
		<Badge variant="outline" class="gap-1">
			{tag}
			<button
				type="button"
				onclick={() => removeTag(index)}
				aria-label={`Remove ${tag}`}
				class="rounded-full hover:text-destructive"
			>
				<XIcon class="size-3" />
			</button>
		</Badge>
	{/each}
</div>

<div class="flex gap-2">
	<Input {id} bind:value={draft} {placeholder} onkeydown={onKeydown} />
	<Button type="button" variant="outline" onclick={addDraft}>Add</Button>
</div>
