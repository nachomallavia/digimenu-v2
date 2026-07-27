import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProductTag } from "@/lib/domain";
import { throwOnError } from "./errors";

export async function listProductTags(
	supabase: SupabaseClient,
	productId: string,
): Promise<ProductTag[]> {
	const { data, error } = await supabase
		.from("product_tags")
		.select("*")
		.eq("product_id", productId);
	throwOnError(error, "Failed to list product tags");
	return (data ?? []) as ProductTag[];
}

/** All product↔tag rows for a restaurant (CSV export). */
export async function listProductTagsByRestaurant(
	supabase: SupabaseClient,
	restaurantId: string,
): Promise<ProductTag[]> {
	const { data, error } = await supabase
		.from("product_tags")
		.select("*")
		.eq("restaurant_id", restaurantId);
	throwOnError(error, "Failed to list product tags");
	return (data ?? []) as ProductTag[];
}

/** Replace tags for a product. */
export async function setProductTags(
	supabase: SupabaseClient,
	restaurantId: string,
	productId: string,
	tagIds: string[],
): Promise<ProductTag[]> {
	const { error: deleteError } = await supabase
		.from("product_tags")
		.delete()
		.eq("product_id", productId)
		.eq("restaurant_id", restaurantId);
	throwOnError(deleteError, "Failed to clear product tags");

	if (tagIds.length === 0) {
		return [];
	}

	const rows = tagIds.map((tag_id) => ({
		product_id: productId,
		tag_id,
		restaurant_id: restaurantId,
	}));

	const { data, error } = await supabase.from("product_tags").insert(rows).select("*");
	throwOnError(error, "Failed to set product tags");
	return (data ?? []) as ProductTag[];
}
