import type { SupabaseClient } from "@supabase/supabase-js";
import type { Menu, MenuInsert, MenuUpdate } from "@/lib/domain";
import { throwOnError } from "./errors";

export async function listMenusByRestaurant(
	supabase: SupabaseClient,
	restaurantId: string,
): Promise<Menu[]> {
	const { data, error } = await supabase
		.from("menus")
		.select("*")
		.eq("restaurant_id", restaurantId)
		.order("sort_order", { ascending: true })
		.order("name", { ascending: true });
	throwOnError(error, "Failed to list menus");
	return (data ?? []) as Menu[];
}

export async function getMenuById(supabase: SupabaseClient, id: string): Promise<Menu | null> {
	const { data, error } = await supabase.from("menus").select("*").eq("id", id).maybeSingle();
	throwOnError(error, "Failed to load menu");
	return data as Menu | null;
}

export async function getMenuBySlug(
	supabase: SupabaseClient,
	restaurantId: string,
	slug: string,
): Promise<Menu | null> {
	const { data, error } = await supabase
		.from("menus")
		.select("*")
		.eq("restaurant_id", restaurantId)
		.eq("slug", slug)
		.maybeSingle();
	throwOnError(error, "Failed to load menu");
	return data as Menu | null;
}

export async function createMenu(supabase: SupabaseClient, input: MenuInsert): Promise<Menu> {
	const { data, error } = await supabase.from("menus").insert(input).select("*").single();
	throwOnError(error, "Failed to create menu");
	return data as Menu;
}

export async function updateMenu(
	supabase: SupabaseClient,
	id: string,
	patch: MenuUpdate,
): Promise<Menu> {
	const { data, error } = await supabase
		.from("menus")
		.update(patch)
		.eq("id", id)
		.select("*")
		.single();
	throwOnError(error, "Failed to update menu");
	return data as Menu;
}

export async function deleteMenu(supabase: SupabaseClient, id: string): Promise<void> {
	const { error } = await supabase.from("menus").delete().eq("id", id);
	throwOnError(error, "Failed to delete menu");
}
