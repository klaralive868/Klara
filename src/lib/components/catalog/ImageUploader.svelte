<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { FieldError } from '$lib/components/ui/field/index.js';
	import type { CatalogItemImage } from '$lib/catalog/types';

	let { images, message }: { images: readonly CatalogItemImage[]; message?: string } = $props();

	const id = $props.id();
</script>

<div>
	<p class="mb-2 text-sm font-medium">Images</p>

	{#if message}
		<FieldError errors={[{ message }]} />
	{/if}

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
						<form method="POST" action="?/setPrimaryImage">
							<input type="hidden" name="imageId" value={image.id} />
							<Button type="submit" variant="ghost" size="xs">Set primary</Button>
						</form>
					{/if}
					<form method="POST" action="?/removeImage">
						<input type="hidden" name="imageId" value={image.id} />
						<Button type="submit" variant="ghost" size="xs">Remove</Button>
					</form>
				</div>
			{/each}
		</div>
	{/if}

	<form
		method="POST"
		action="?/uploadImages"
		enctype="multipart/form-data"
		class="flex items-center gap-2"
	>
		<label for="images-{id}" class="sr-only">Choose images to upload</label>
		<input id="images-{id}" type="file" name="images" accept="image/*" multiple class="text-sm" />
		<Button type="submit" variant="outline">Upload</Button>
	</form>
</div>
