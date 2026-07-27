import type { SupabaseClient } from "@supabase/supabase-js";
import type { MenuProduct } from "@/lib/domain";
import { listMenuProducts, setMenuProducts, throwOnError } from "@/lib/server/db";

/**
 * Sync which menus include a product (product → menus).
 * Preserves sort_order for menus that already include the product; appends at end for new ones.
 */
export async function syncProductMenuMembership(
	supabase: SupabaseClient,
	restaurantId: string,
	productId: string,
	menuIds: string[],
): Promise<void> {
	const target = new Set(menuIds);

	const { data: existing, error } = await supabase
		.from("menu_products")
		.select("*")
		.eq("restaurant_id", restaurantId)
		.eq("product_id", productId);
	throwOnError(error, "Failed to list product menu membership");

	const currentRows = (existing ?? []) as MenuProduct[];
	const currentMenuIds = new Set(currentRows.map((r) => r.menu_id));

	for (const row of currentRows) {
		if (!target.has(row.menu_id)) {
			const ordered = await listMenuProducts(supabase, row.menu_id);
			await setMenuProducts(
				supabase,
				restaurantId,
				row.menu_id,
				ordered.filter((mp) => mp.product_id !== productId).map((mp) => mp.product_id),
			);
		}
	}

	for (const menuId of target) {
		if (currentMenuIds.has(menuId)) continue;
		const ordered = await listMenuProducts(supabase, menuId);
		await setMenuProducts(supabase, restaurantId, menuId, [
			...ordered.map((mp) => mp.product_id),
			productId,
		]);
	}
}
