import type { SupabaseClient } from "@supabase/supabase-js";
import type { Restaurant } from "@/lib/domain";
import { throwOnError } from "./errors";

export async function listOwnerRestaurantIds(
	supabase: SupabaseClient,
	userId: string,
): Promise<string[]> {
	const { data, error } = await supabase
		.from("owner_restaurants")
		.select("restaurant_id")
		.eq("user_id", userId);
	throwOnError(error, "Failed to list owner restaurant ids");
	return (data ?? []).map((row) => row.restaurant_id as string);
}

export async function listRestaurantsForUser(
	supabase: SupabaseClient,
	userId: string,
): Promise<Restaurant[]> {
	const ids = await listOwnerRestaurantIds(supabase, userId);
	if (ids.length === 0) {
		return [];
	}

	const { data, error } = await supabase
		.from("restaurants")
		.select("*")
		.in("id", ids)
		.order("name", { ascending: true });
	throwOnError(error, "Failed to list restaurants for user");
	return (data ?? []) as Restaurant[];
}
