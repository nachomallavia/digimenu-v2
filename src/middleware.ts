import { defineMiddleware } from "astro:middleware";
import { createSupabaseServerClient } from "@/lib/server/auth";

/**
 * Refresh Supabase Auth cookies on each request and expose `locals.user`.
 */
export const onRequest = defineMiddleware(async (context, next) => {
	const supabase = createSupabaseServerClient(context.request, context.cookies);
	const {
		data: { user },
	} = await supabase.auth.getUser();

	context.locals.user = user;
	context.locals.supabase = supabase;

	return next();
});
