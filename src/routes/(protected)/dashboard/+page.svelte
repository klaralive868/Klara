<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
</script>

<main class="mx-auto mt-16 max-w-sm">
	<h1 class="mb-6 text-xl font-semibold">Dashboard</h1>

	<form method="POST" action="?/signOut">
		<Button type="submit">Sign out</Button>
	</form>
</main>
