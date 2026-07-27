/** Public Supabase env for SSR clients (anon / publishable). Never service role here. */

export function getSupabasePublicEnv(): { url: string; anonKey: string } {
	const url = import.meta.env.PUBLIC_SUPABASE_URL;
	const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

	if (!url || !anonKey) {
		throw new Error("Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY");
	}

	return { url, anonKey };
}
