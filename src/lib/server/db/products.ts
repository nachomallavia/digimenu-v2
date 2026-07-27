import type { SupabaseClient } from "@supabase/supabase-js";
import type { Product, ProductInsert, ProductUpdate } from "@/lib/domain";
import { throwOnError } from "./errors";

type ProductRow = Omit<Product, "price"> & { price: number | string };

function mapProduct(row: ProductRow): Product {
	return {
		...row,
		price: typeof row.price === "string" ? Number(row.price) : row.price,
	};
}

export async function listProductsByRestaurant(
	supabase: SupabaseClient,
	restaurantId: string,
): Promise<Product[]> {
	const { data, error } = await supabase
		.from("products")
		.select("*")
		.eq("restaurant_id", restaurantId)
		.order("name", { ascending: true });
	throwOnError(error, "Failed to list products");
	return ((data ?? []) as ProductRow[]).map(mapProduct);
}

export async function getProductById(
	supabase: SupabaseClient,
	id: string,
): Promise<Product | null> {
	const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
	throwOnError(error, "Failed to load product");
	return data ? mapProduct(data as ProductRow) : null;
}

export async function getProductBySlug(
	supabase: SupabaseClient,
	restaurantId: string,
	slug: string,
): Promise<Product | null> {
	const { data, error } = await supabase
		.from("products")
		.select("*")
		.eq("restaurant_id", restaurantId)
		.eq("slug", slug)
		.maybeSingle();
	throwOnError(error, "Failed to load product");
	return data ? mapProduct(data as ProductRow) : null;
}

export async function createProduct(
	supabase: SupabaseClient,
	input: ProductInsert,
): Promise<Product> {
	const { data, error } = await supabase.from("products").insert(input).select("*").single();
	throwOnError(error, "Failed to create product");
	return mapProduct(data as ProductRow);
}

export async function updateProduct(
	supabase: SupabaseClient,
	id: string,
	patch: ProductUpdate,
): Promise<Product> {
	const { data, error } = await supabase
		.from("products")
		.update(patch)
		.eq("id", id)
		.select("*")
		.single();
	throwOnError(error, "Failed to update product");
	return mapProduct(data as ProductRow);
}

export async function deleteProduct(supabase: SupabaseClient, id: string): Promise<void> {
	const { error } = await supabase.from("products").delete().eq("id", id);
	throwOnError(error, "Failed to delete product");
}
