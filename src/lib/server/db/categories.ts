import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category, CategoryInsert, CategoryUpdate } from "@/lib/domain";
import { throwOnError } from "./errors";

export async function listCategoriesByRestaurant(
	supabase: SupabaseClient,
	restaurantId: string,
): Promise<Category[]> {
	const { data, error } = await supabase
		.from("categories")
		.select("*")
		.eq("restaurant_id", restaurantId)
		.order("sort_order", { ascending: true })
		.order("name", { ascending: true });
	throwOnError(error, "Failed to list categories");
	return (data ?? []) as Category[];
}

export async function getCategoryById(
	supabase: SupabaseClient,
	id: string,
): Promise<Category | null> {
	const { data, error } = await supabase.from("categories").select("*").eq("id", id).maybeSingle();
	throwOnError(error, "Failed to load category");
	return data as Category | null;
}

export async function getCategoryBySlug(
	supabase: SupabaseClient,
	restaurantId: string,
	slug: string,
): Promise<Category | null> {
	const { data, error } = await supabase
		.from("categories")
		.select("*")
		.eq("restaurant_id", restaurantId)
		.eq("slug", slug)
		.maybeSingle();
	throwOnError(error, "Failed to load category");
	return data as Category | null;
}

export async function createCategory(
	supabase: SupabaseClient,
	input: CategoryInsert,
): Promise<Category> {
	const { data, error } = await supabase.from("categories").insert(input).select("*").single();
	throwOnError(error, "Failed to create category");
	return data as Category;
}

export async function updateCategory(
	supabase: SupabaseClient,
	id: string,
	patch: CategoryUpdate,
): Promise<Category> {
	const { data, error } = await supabase
		.from("categories")
		.update(patch)
		.eq("id", id)
		.select("*")
		.single();
	throwOnError(error, "Failed to update category");
	return data as Category;
}

export async function deleteCategory(supabase: SupabaseClient, id: string): Promise<void> {
	const { error } = await supabase.from("categories").delete().eq("id", id);
	throwOnError(error, "Failed to delete category");
}
