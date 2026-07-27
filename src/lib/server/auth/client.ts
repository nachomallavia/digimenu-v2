import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import type { AstroCookies } from "astro";
import { getSupabasePublicEnv } from "./env";

/**
 * Supabase SSR client bound to the current request cookies.
 * Use from pages, middleware, Actions, and API routes — never in the browser.
 */
export function createSupabaseServerClient(request: Request, cookies: AstroCookies) {
	const { url, anonKey } = getSupabasePublicEnv();

	return createServerClient(url, anonKey, {
		cookies: {
			getAll() {
				return parseCookieHeader(request.headers.get("Cookie") ?? "").map(
					({ name, value }) => ({
						name,
						value: value ?? "",
					}),
				);
			},
			setAll(cookiesToSet) {
				for (const { name, value, options } of cookiesToSet) {
					cookies.set(name, value, options);
				}
			},
		},
	});
}
