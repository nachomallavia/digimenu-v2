import type { SupabaseClient } from "@supabase/supabase-js";
import type { Restaurant, RestaurantUpdate } from "@/lib/domain";
import { throwOnError } from "./errors";

export async function getRestaurantById(
	supabase: SupabaseClient,
	id: string,
): Promise<Restaurant | null> {
	const { data, error } = await supabase.from("restaurants").select("*").eq("id", id).maybeSingle();
	throwOnError(error, "Failed to load restaurant");
	return data as Restaurant | null;
}

export async function getRestaurantBySlug(
	supabase: SupabaseClient,
	slug: string,
): Promise<Restaurant | null> {
	const { data, error } = await supabase
		.from("restaurants")
		.select("*")
		.eq("slug", slug)
		.maybeSingle();
	throwOnError(error, "Failed to load restaurant");
	return data as Restaurant | null;
}

export async function updateRestaurant(
	supabase: SupabaseClient,
	id: string,
	patch: RestaurantUpdate,
): Promise<Restaurant> {
	const { data, error } = await supabase
		.from("restaurants")
		.update(patch)
		.eq("id", id)
		.select("*")
		.single();
	throwOnError(error, "Failed to update restaurant");
	return data as Restaurant;
}

export async function deleteRestaurant(supabase: SupabaseClient, id: string): Promise<void> {
	const { error } = await supabase.from("restaurants").delete().eq("id", id);
	throwOnError(error, "Failed to delete restaurant");
}
