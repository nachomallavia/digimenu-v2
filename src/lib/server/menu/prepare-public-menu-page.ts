/**
 * Shared orchestration for `/m/[restaurant]` and `/m/[restaurant]/[menu]`.
 */
import type { APIContext } from "astro";
import type { Menu } from "@/lib/domain";
import { findMenuBySlug, loadPublicRestaurant } from "./load-public-menu";
import type { MenuViewModel, PublicRestaurantLoad } from "./types";
import { buildMenuViewModel } from "./view-model";

type AstroLike = {
	params: APIContext["params"];
	locals: APIContext["locals"];
	url: APIContext["url"];
	rewrite: APIContext["rewrite"];
	redirect: APIContext["redirect"];
	cache?: APIContext["cache"];
};

export type PreparePublicMenuPageOpts = {
	/** When set, resolve that menu slug; otherwise use first menu. */
	menuSlug?: string;
	initialView: "landing" | "menu";
};

export type PreparedPublicMenuPage = {
	loaded: PublicRestaurantLoad;
	viewModel: MenuViewModel;
	multiMenu: boolean;
	initialView: "landing" | "menu";
	title: string;
	activeMenu: Menu;
};

/**
 * Returns a prepared page model, or a Response (rewrite/redirect) from Astro.
 */
export async function preparePublicMenuPage(
	Astro: AstroLike,
	opts: PreparePublicMenuPageOpts,
): Promise<PreparedPublicMenuPage | Response> {
	const restaurantParam = Astro.params.restaurant;
	if (!restaurantParam) {
		return Astro.rewrite("/404");
	}

	if (!opts.menuSlug) {
		const legacyMenu = Astro.url.searchParams.get("menu");
		if (legacyMenu) {
			return Astro.redirect(
				`/m/${encodeURIComponent(restaurantParam)}/${encodeURIComponent(legacyMenu)}`,
				301,
			);
		}
	}

	const loaded = await loadPublicRestaurant(Astro.locals.supabase, restaurantParam);
	if (!loaded) {
		return Astro.rewrite("/404");
	}

	const activeMenu = opts.menuSlug
		? findMenuBySlug(loaded.menus, opts.menuSlug)
		: loaded.menus[0];
	if (!activeMenu) {
		return Astro.rewrite("/404");
	}

	const multiMenu = loaded.menus.length > 1;
	const viewModel = buildMenuViewModel({ loaded, activeMenu });

	if (Astro.cache?.enabled) {
		Astro.cache.set({
			tags: [`restaurant:${loaded.restaurantId}`],
		});
	}

	const title = opts.menuSlug
		? `${loaded.restaurant.name} — ${activeMenu.name}`
		: loaded.restaurant.name;

	return {
		loaded,
		viewModel,
		multiMenu,
		initialView: opts.initialView,
		title,
		activeMenu,
	};
}

export function isPreparedPublicMenuPage(
	value: PreparedPublicMenuPage | Response,
): value is PreparedPublicMenuPage {
	return (
		typeof value === "object" &&
		value !== null &&
		"viewModel" in value &&
		"loaded" in value
	);
}
