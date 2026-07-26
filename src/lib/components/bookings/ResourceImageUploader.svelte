<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import type { PlaceholderResourceImage } from '$lib/bookings/placeholder-resource-images';

	let { images = $bindable([]) }: { images: PlaceholderResourceImage[] } = $props();

	const id = $props.id();

	let fileInput = $state<HTMLInputElement | null>(null);
	let files = $state<FileList | null>(null);

	const selectionLabel = $derived(
		!files || files.length === 0
			? 'No file chosen'
			: files.length === 1
				? files[0].name
				: `${files.length} files selected`
	);

	// No Storage to upload to yet (#40) — createObjectURL gives a real,
	// browser-local preview of whatever the agent picked, so this still
	// demonstrates the actual flow rather than a fake stand-in image.
	function upload() {
		if (!files || files.length === 0) {
			return;
		}

		const uploaded: PlaceholderResourceImage[] = Array.from(files).map((file) => ({
			id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
			isPrimary: false,
			url: URL.createObjectURL(file)
		}));

		// First image ever added is auto-marked primary — mirrors the rule
		// #40 will enforce for real (see catalog_item_images' own
		// first-upload-primary trigger, the precedent this mirrors).
		if (images.length === 0 && uploaded.length > 0) {
			uploaded[0].isPrimary = true;
		}

		images = [...images, ...uploaded];
		files = null;
		if (fileInput) {
			fileInput.value = '';
		}
	}

	function setPrimary(imageId: string) {
		images = images.map((image) => ({ ...image, isPrimary: image.id === imageId }));
	}

	function remove(imageId: string) {
		const wasPrimary = images.find((image) => image.id === imageId)?.isPrimary ?? false;
		const remaining = images.filter((image) => image.id !== imageId);

		// Removing the primary image promotes the next-oldest remaining one —
		// mirrors the rule #40 will enforce for real (same precedent as above).
		if (wasPrimary && remaining.length > 0) {
			remaining[0].isPrimary = true;
		}

		images = remaining;
	}
</script>

<div>
	<p class="mb-2 text-sm font-medium">Images</p>

	{#if images.length > 0}
		<div class="mb-3 flex flex-wrap gap-3">
			{#each images as image, index (image.id)}
				<div class="flex flex-col items-center gap-1">
					<img
						src={image.url}
						alt="Image {index + 1} preview"
						class="h-20 w-20 rounded-md border border-border object-cover"
					/>
					{#if image.isPrimary}
						<span class="text-xs font-medium text-primary">Primary</span>
					{:else}
						<Button type="button" variant="ghost" size="xs" onclick={() => setPrimary(image.id)}>
							Set primary
						</Button>
					{/if}
					<Button type="button" variant="ghost" size="xs" onclick={() => remove(image.id)}>
						Remove
					</Button>
				</div>
			{/each}
		</div>
	{/if}

	<label for="images-{id}" class="sr-only">Choose images to upload</label>
	<input
		bind:this={fileInput}
		bind:files
		id="images-{id}"
		type="file"
		accept="image/*"
		multiple
		tabindex="-1"
		class="sr-only"
	/>
	<div class="flex flex-wrap items-center gap-3">
		<Button type="button" variant="outline" onclick={() => fileInput?.click()}>
			Choose files
		</Button>
		<span class="text-sm text-muted-foreground">{selectionLabel}</span>
		<Button type="button" onclick={upload} disabled={!files || files.length === 0}>Upload</Button>
	</div>
</div>
