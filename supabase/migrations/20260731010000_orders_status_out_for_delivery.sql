-- Rename the 'fulfilled' order status to 'out_for_delivery' — the dashboard
-- now lets an agent walk an order through pending -> confirmed ->
-- out_for_delivery (still cancellable from pending/confirmed). No new
-- inventory action on any transition: stock is already decremented
-- atomically at checkout time (checkout_cart), before the order exists.
update public.orders set status = 'out_for_delivery' where status = 'fulfilled';

alter table public.orders drop constraint orders_status_check;
alter table public.orders add constraint orders_status_check
	check (status in ('pending', 'confirmed', 'out_for_delivery', 'cancelled'));
