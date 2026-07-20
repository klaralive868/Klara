import type { SupabaseClient } from '@supabase/supabase-js';

export async function isOperator(supabase: SupabaseClient, userId: string): Promise<boolean> {
	const { data, error } = await supabase
		.from('operators')
		.select('user_id')
		.eq('user_id', userId)
		.maybeSingle();

	return !error && data !== null;
}
