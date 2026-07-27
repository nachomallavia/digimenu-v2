import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tag, TagInsert, TagUpdate } from "@/lib/domain";
import { throwOnError } from "./errors";

export async function listTagsByRestaurant(
	supabase: SupabaseClient,
	restaurantId: string,
): Promise<Tag[]> {
	const { data, error } = await supabase
		.from("tags")
		.select("*")
		.eq("restaurant_id", restaurantId)
		.order("name", { ascending: true });
	throwOnError(error, "Failed to list tags");
	return (data ?? []) as Tag[];
}

export async function getTagById(supabase: SupabaseClient, id: string): Promise<Tag | null> {
	const { data, error } = await supabase.from("tags").select("*").eq("id", id).maybeSingle();
	throwOnError(error, "Failed to load tag");
	return data as Tag | null;
}

export async function getTagBySlug(
	supabase: SupabaseClient,
	restaurantId: string,
	slug: string,
): Promise<Tag | null> {
	const { data, error } = await supabase
		.from("tags")
		.select("*")
		.eq("restaurant_id", restaurantId)
		.eq("slug", slug)
		.maybeSingle();
	throwOnError(error, "Failed to load tag");
	return data as Tag | null;
}

export async function createTag(supabase: SupabaseClient, input: TagInsert): Promise<Tag> {
	const { data, error } = await supabase.from("tags").insert(input).select("*").single();
	throwOnError(error, "Failed to create tag");
	return data as Tag;
}

export async function updateTag(
	supabase: SupabaseClient,
	id: string,
	patch: TagUpdate,
): Promise<Tag> {
	const { data, error } = await supabase
		.from("tags")
		.update(patch)
		.eq("id", id)
		.select("*")
		.single();
	throwOnError(error, "Failed to update tag");
	return data as Tag;
}

export async function deleteTag(supabase: SupabaseClient, id: string): Promise<void> {
	const { error } = await supabase.from("tags").delete().eq("id", id);
	throwOnError(error, "Failed to delete tag");
}
