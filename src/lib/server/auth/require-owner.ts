import type { AstroCookies } from "astro";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Restaurant } from "@/lib/domain";
import { DbError, listRestaurantsForUser } from "@/lib/server/db";

export type OwnerRestaurant = Pick<
	Restaurant,
	"id" | "slug" | "name" | "logo_light_url" | "logo_dark_url"
>;

export type OwnerContext = {
	userId: string;
	email: string | undefined;
	restaurant: OwnerRestaurant;
};

/**
 * Accept any Astro-like context. `locals` is `unknown` so empty `App.Locals`
 * (or orphan worktree checkers) still accept `requireOwner(Astro)`.
 * Middleware sets `user` / `supabase` at runtime.
 */
type RequireOwnerContext = {
	request: Request;
	cookies: AstroCookies;
	redirect: (path: string) => Response;
	locals: unknown;
};

function toOwnerRestaurant(row: Restaurant): OwnerRestaurant {
	return {
		id: row.id,
		slug: row.slug,
		name: row.name,
		logo_light_url: row.logo_light_url,
		logo_dark_url: row.logo_dark_url,
	};
}

/**
 * Ensures Auth user + at least one `owner_restaurants` mapping.
 * Active restaurant = first by name (Alpha; switcher later).
 * No digimenu_owner cookie — Supabase session + DB lookup.
 */
export async function requireOwner(
	context: RequireOwnerContext,
): Promise<OwnerContext | Response> {
	const { user, supabase } = context.locals as {
		user?: User | null;
		supabase?: SupabaseClient;
	};
	if (!user || !supabase) {
		return context.redirect("/app/login");
	}

	try {
		const restaurants = await listRestaurantsForUser(supabase, user.id);
		if (restaurants.length === 0) {
			return context.redirect("/app/pending");
		}

		const restaurant = toOwnerRestaurant(restaurants[0]!);
		return {
			userId: user.id,
			email: user.email,
			restaurant,
		};
	} catch (err) {
		const message = err instanceof DbError ? err.message : "lookup failed";
		console.error("[requireOwner]", message);
		return context.redirect("/app/pending?error=lookup");
	}
}
