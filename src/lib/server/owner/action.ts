import { ActionError } from "astro:actions";
import type { ActionAPIContext } from "astro:actions";
import type { OwnerContext } from "@/lib/server/auth";
import { DbError, listRestaurantsForUser } from "@/lib/server/db";
import type { Restaurant } from "@/lib/domain";

function toOwnerRestaurant(row: Restaurant): OwnerContext["restaurant"] {
	return {
		id: row.id,
		slug: row.slug,
		name: row.name,
		logo_light_url: row.logo_light_url,
		logo_dark_url: row.logo_dark_url,
	};
}

/**
 * Action-safe owner gate (throws ActionError instead of redirecting).
 * Active restaurant = first by name (Alpha).
 */
export async function requireOwnerAction(context: ActionAPIContext): Promise<OwnerContext> {
	const user = context.locals.user;
	if (!user) {
		throw new ActionError({ code: "UNAUTHORIZED", message: "Tenés que iniciar sesión." });
	}

	try {
		const restaurants = await listRestaurantsForUser(context.locals.supabase, user.id);
		if (restaurants.length === 0) {
			throw new ActionError({
				code: "FORBIDDEN",
				message: "Tu cuenta aún no está vinculada a un restaurante.",
			});
		}

		return {
			userId: user.id,
			email: user.email,
			restaurant: toOwnerRestaurant(restaurants[0]!),
		};
	} catch (err) {
		if (err instanceof ActionError) throw err;
		const message = err instanceof DbError ? err.message : "lookup failed";
		console.error("[requireOwnerAction]", message);
		throw new ActionError({
			code: "INTERNAL_SERVER_ERROR",
			message: "No se pudo verificar el restaurante.",
		});
	}
}

/** Map DbError (and unknown) to ActionError for handlers. */
export function toActionError(err: unknown, fallback = "No se pudo guardar."): never {
	if (err instanceof ActionError) throw err;
	const message = err instanceof DbError ? err.message : fallback;
	console.error("[action]", message);
	throw new ActionError({
		code: "BAD_REQUEST",
		message: fallback,
	});
}
