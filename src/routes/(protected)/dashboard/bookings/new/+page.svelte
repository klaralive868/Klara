<script lang="ts">
	import SiteHeader from '$lib/components/site-header.svelte';
	import BookingForm from '$lib/components/bookings/BookingForm.svelte';
</script>

<SiteHeader title="Log booking" />
<div class="@container/main flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
	<div class="max-w-lg">
		<BookingForm />
	</div>
</div>
