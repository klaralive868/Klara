<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';

	interface LocalImage {
		id: string;
		url: string;
	}

	const id = $props.id();

	// Local-only preview state — no backend/storage yet (ticket #18 wires real
	// Supabase Storage upload). Object URLs are revoked on removal and on
	// unmount so previewing images doesn't leak memory.
	let images = $state<LocalImage[]>([]);
	let primaryId = $state<string | null>(null);

	function onFilesSelected(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const files = Array.from(input.files ?? []);

		for (const file of files) {
			const imageId = crypto.randomUUID();
			images.push({ id: imageId, url: URL.createObjectURL(file) });
			// The first image uploaded for an item is auto-marked primary, so
			// the common single-image case needs no extra step.
			if (primaryId === null) {
				primaryId = imageId;
			}
		}

		// Reset so selecting the same file(s) again still fires a change event.
		input.value = '';
	}

	function setPrimary(imageId: string) {
		primaryId = imageId;
	}

	function removeImage(imageId: string) {
		const index = images.findIndex((image) => image.id === imageId);
		if (index === -1) return;

		URL.revokeObjectURL(images[index].url);
		images.splice(index, 1);

		if (primaryId === imageId) {
			primaryId = images[0]?.id ?? null;
		}
	}

	$effect(() => {
		return () => {
			for (const image of images) {
				URL.revokeObjectURL(image.url);
			}
		};
	});
</script>

<div>
	<label for="images-{id}" class="mb-2 block text-sm font-medium">Images</label>
	<input
		id="images-{id}"
		type="file"
		accept="image/*"
		multiple
		onchange={onFilesSelected}
		class="text-sm"
	/>

	{#if images.length > 0}
		<div class="mt-3 flex flex-wrap gap-3">
			{#each images as image, index (image.id)}
				<div class="flex flex-col items-center gap-1">
					<img
						src={image.url}
						alt="Image {index + 1} preview"
						class="h-20 w-20 rounded-md border border-border object-cover"
					/>
					{#if primaryId === image.id}
						<span class="text-xs font-medium text-primary">Primary</span>
					{:else}
						<Button type="button" variant="ghost" size="xs" onclick={() => setPrimary(image.id)}>
							Set primary
						</Button>
					{/if}
					<Button type="button" variant="ghost" size="xs" onclick={() => removeImage(image.id)}>
						Remove
					</Button>
				</div>
			{/each}
		</div>
	{/if}
</div>
