<script lang="ts">
	import { getMaterialType } from '$lib/catalog/material-types';

	let { materialType }: { materialType: string } = $props();
</script>

<span>{getMaterialType(materialType)?.label ?? materialType}</span>
