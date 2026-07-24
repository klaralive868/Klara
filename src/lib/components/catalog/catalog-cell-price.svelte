<script lang="ts">
	let { priceCents }: { priceCents: number } = $props();
</script>

<span>${(priceCents / 100).toFixed(2)}</span>
