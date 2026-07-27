import type { AstroCookies } from "astro";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "./client";

export async function getUser(request: Request, cookies: AstroCookies): Promise<User | null> {
	const supabase = createSupabaseServerClient(request, cookies);
	const {
		data: { user },
	} = await supabase.auth.getUser();
	return user;
}

type RequireUserContext = {
	request: Request;
	cookies: AstroCookies;
	redirect: (path: string) => Response;
};

/**
 * Ensures a Supabase Auth user is present.
 * Returns the user, or a redirect Response to `/app/login`.
 * Restaurant tenancy is `requireOwner` (DIG-13) — not checked here.
 */
export async function requireUser(
	context: RequireUserContext,
): Promise<User | Response> {
	const user = await getUser(context.request, context.cookies);
	if (!user) {
		return context.redirect("/app/login");
	}
	return user;
}
