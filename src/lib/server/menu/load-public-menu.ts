import type { SupabaseClient } from "@supabase/supabase-js";
import {
	DEFAULT_MENU_TEMPLATE_ID,
	parseRestaurantBrand,
	parseRestaurantTheme,
	type Menu,
} from "@/lib/domain";
import {
	getRestaurantBySlug,
	listCategoriesByRestaurant,
	listMenuProductsByRestaurant,
	listMenusByRestaurant,
	listProductTagsByRestaurant,
	listProductsByRestaurant,
	listTagsByRestaurant,
} from "@/lib/server/db";
import { buildProductMenuIdsMap } from "./membership";
import type { PublicRestaurantLoad } from "./types";

const SYNTHETIC_MENU_ID = "_default";

function sortByOrderName<T extends { sort_order: number; name: string }>(items: T[]): T[] {
	return items.slice().sort((a, b) => {
		if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
		return a.name.localeCompare(b.name);
	});
}

function syntheticCarta(restaurantId: string): Menu {
	const now = new Date(0).toISOString();
	return {
		id: SYNTHETIC_MENU_ID,
		restaurant_id: restaurantId,
		slug: "carta",
		name: "Carta",
		description: null,
		sort_order: 0,
		template: DEFAULT_MENU_TEMPLATE_ID,
		icon: null,
		active: true,
		created_at: now,
		updated_at: now,
	};
}

function buildProductTagIdsMap(
	rows: Array<{ product_id: string; tag_id: string }>,
): Map<string, string[]> {
	const map = new Map<string, string[]>();
	for (const { product_id, tag_id } of rows) {
		const list = map.get(product_id) ?? [];
		if (!list.includes(tag_id)) list.push(tag_id);
		map.set(product_id, list);
	}
	return map;
}

/**
 * Load public restaurant catalog for `/m/{slug}`.
 * Relies on RLS for anon `active` filtering; also drops inactive rows defensively.
 */
export async function loadPublicRestaurant(
	supabase: SupabaseClient,
	restaurantSlug: string,
): Promise<PublicRestaurantLoad | null> {
	const restaurant = await getRestaurantBySlug(supabase, restaurantSlug);
	if (!restaurant || !restaurant.active) return null;

	const restaurantId = restaurant.id;

	const [menusRaw, categoriesRaw, tagsRaw, productsRaw, menuProductRows, productTagRows] =
		await Promise.all([
			listMenusByRestaurant(supabase, restaurantId),
			listCategoriesByRestaurant(supabase, restaurantId),
			listTagsByRestaurant(supabase, restaurantId),
			listProductsByRestaurant(supabase, restaurantId),
			listMenuProductsByRestaurant(supabase, restaurantId),
			listProductTagsByRestaurant(supabase, restaurantId),
		]);

	const menusListed = sortByOrderName(menusRaw.filter((m) => m.active));
	const categories = sortByOrderName(categoriesRaw.filter((c) => c.active));
	const tags = tagsRaw.filter((t) => t.active);
	const products = productsRaw.filter((p) => p.active);

	const hasDbMenus = menusListed.length > 0;
	const menus = hasDbMenus ? menusListed : [syntheticCarta(restaurantId)];

	const productMenuIds = buildProductMenuIdsMap(menuProductRows, {
		treatEmptyAsAll: !hasDbMenus,
		soleMenuId: menus.length === 1 ? menus[0]!.id : undefined,
	});

	return {
		restaurant,
		restaurantId,
		restaurantSlug: restaurant.slug,
		theme: parseRestaurantTheme(restaurant.theme),
		brand: parseRestaurantBrand(restaurant.brand),
		menus,
		hasDbMenus,
		categories,
		tags,
		products,
		productMenuIds,
		productTagIds: buildProductTagIdsMap(productTagRows),
	};
}

export function findMenuBySlug(menus: Menu[], menuSlug: string): Menu | undefined {
	return menus.find((m) => m.slug === menuSlug || m.id === menuSlug);
}
