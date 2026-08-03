<script lang="ts">
	import { parseDate } from '@internationalized/date';
	import type { DateRange } from 'bits-ui';
	import PlusCircleIcon from '@lucide/svelte/icons/circle-plus';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { RangeCalendar } from '$lib/components/ui/range-calendar/index.js';

	// ISO "YYYY-MM-DD" strings in/out — matches how every date field value is
	// already stored (parseFieldValues, customers/orders custom_fields) — the
	// @internationalized/date conversion is entirely internal to this
	// component, never leaking into the rest of the app.
	let {
		title,
		from = $bindable(null),
		to = $bindable(null)
	}: { title: string; from: string | null; to: string | null } = $props();

	let open = $state(false);

	const rangeValue: DateRange = $derived({
		start: from ? parseDate(from) : undefined,
		end: to ? parseDate(to) : undefined
	});

	function onValueChange(value: DateRange) {
		from = value.start ? value.start.toString() : null;
		to = value.end ? value.end.toString() : null;
	}

	function clear() {
		from = null;
		to = null;
		open = false;
	}

	const active = $derived(from !== null || to !== null);
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="outline" size="sm" class="border-dashed">
				<PlusCircleIcon />
				{title}
				{#if active}
					<Badge variant="secondary" class="rounded-sm">
						{from ?? '…'} – {to ?? '…'}
					</Badge>
				{/if}
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-auto p-0" align="start">
		<RangeCalendar value={rangeValue} {onValueChange} />
		<div class="flex justify-end gap-2 border-t p-2">
			<Button variant="ghost" size="sm" onclick={clear}>Clear</Button>
			<Button size="sm" onclick={() => (open = false)}>Done</Button>
		</div>
	</Popover.Content>
</Popover.Root>
