import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "@/lib/server/auth";

export const GET: APIRoute = async ({ request, cookies, redirect, url }) => {
	const code = url.searchParams.get("code");
	const next = url.searchParams.get("next") ?? "/app";

	if (!code) {
		return redirect("/app/login?error=auth");
	}

	const supabase = createSupabaseServerClient(request, cookies);
	const { error } = await supabase.auth.exchangeCodeForSession(code);

	if (error) {
		console.error("[auth/callback]", error.message);
		return redirect("/app/login?error=auth");
	}

	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return redirect("/app/login?error=auth");
	}

	const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/app";
	return redirect(safeNext);
};
