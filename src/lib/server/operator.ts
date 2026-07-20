import type { SupabaseClient } from '@supabase/supabase-js';

export async function isOperator(supabase: SupabaseClient, userId: string): Promise<boolean> {
	const { data, error } = await supabase
		.from('operators')
		.select('user_id')
		.eq('user_id', userId)
		.maybeSingle();

	if (error) {
		// Fails closed either way (a legitimate operator gets bounced to
		// /dashboard on a transient DB error same as a genuine non-operator) —
		// but that failure mode is indistinguishable from the real thing without
		// this, making it invisible in production logs.
		console.error('isOperator query failed:', error);
		return false;
	}

	return data !== null;
}
