import type { SupabaseClient } from "@supabase/supabase-js";
import type { MenuProduct } from "@/lib/domain";
import { throwOnError } from "./errors";

export async function listMenuProducts(
	supabase: SupabaseClient,
	menuId: string,
): Promise<MenuProduct[]> {
	const { data, error } = await supabase
		.from("menu_products")
		.select("*")
		.eq("menu_id", menuId)
		.order("sort_order", { ascending: true });
	throwOnError(error, "Failed to list menu products");
	return (data ?? []) as MenuProduct[];
}

/** Menus that include a product (for owner detail membership UI). */
export async function listMenuProductsByProduct(
	supabase: SupabaseClient,
	restaurantId: string,
	productId: string,
): Promise<MenuProduct[]> {
	const { data, error } = await supabase
		.from("menu_products")
		.select("*")
		.eq("restaurant_id", restaurantId)
		.eq("product_id", productId);
	throwOnError(error, "Failed to list product menu membership");
	return (data ?? []) as MenuProduct[];
}

/** Replace membership for a menu (ordered product ids). */
export async function setMenuProducts(
	supabase: SupabaseClient,
	restaurantId: string,
	menuId: string,
	productIdsOrdered: string[],
): Promise<MenuProduct[]> {
	const { error: deleteError } = await supabase
		.from("menu_products")
		.delete()
		.eq("menu_id", menuId)
		.eq("restaurant_id", restaurantId);
	throwOnError(deleteError, "Failed to clear menu products");

	if (productIdsOrdered.length === 0) {
		return [];
	}

	const rows = productIdsOrdered.map((product_id, sort_order) => ({
		menu_id: menuId,
		product_id,
		restaurant_id: restaurantId,
		sort_order,
	}));

	const { data, error } = await supabase.from("menu_products").insert(rows).select("*");
	throwOnError(error, "Failed to set menu products");
	return (data ?? []) as MenuProduct[];
}
