import type {
	Category,
	Menu,
	Product,
	Restaurant,
	RestaurantBrand,
	RestaurantTheme,
	Tag,
} from "@/lib/domain";

export type MenuTagView = {
	id: string;
	name: string;
	icon?: string | null;
};

export type MenuProductView = {
	id: string;
	name: string;
	price: number;
	priceLabel: string;
	description?: string | null;
	imageUrl?: string | null;
	/** Category id, or empty for uncategorized. */
	categoryId: string;
	/** Menu ids this product belongs to (from `menu_products`). */
	menuIds: string[];
	/** True when product belongs to the SSR active menu (initial paint). */
	inActiveMenu: boolean;
	/** Stock/availability flag for client UX. */
	available: boolean;
	tags: MenuTagView[];
};

export type MenuSectionView = {
	id: string;
	slug: string;
	label: string;
	icon?: string | null;
	coverUrl?: string | null;
	products: MenuProductView[];
};

export type MenuSwitcherItem = {
	id: string;
	slug: string;
	name: string;
	icon?: string | null;
};

/**
 * Dumb props every menu template accepts.
 * Built by the orchestrator — templates must not regroup or filter.
 */
export type MenuViewModel = {
	restaurantSlug: string;
	restaurant: {
		name: string;
		description?: string | null;
		logoUrl?: string | null;
		logoField?: "logo_light_url" | "logo_dark_url" | null;
	};
	menus: MenuSwitcherItem[];
	activeMenu: {
		id: string;
		slug: string;
		name: string;
		template: string;
	};
	sections: MenuSectionView[];
	/** Flat list of the same products as in sections. */
	products: MenuProductView[];
	/** Categories available for the FilterBar (sections with real category ids). */
	filterCategories: Array<{
		id: string;
		label: string;
		icon?: string | null;
	}>;
	/** Tags used by at least one product in chip scope. */
	filterTags: MenuTagView[];
	theme: RestaurantTheme;
	/**
	 * When true, the DOM includes the full restaurant catalog and the client
	 * scopes visibility by active menu (no SSR roundtrip on switcher).
	 */
	clientMenuSwitch: boolean;
	/** True when menus came from DB (not synthetic-only). */
	hasDbMenus: boolean;
};

export type PublicRestaurantLoad = {
	restaurant: Restaurant;
	restaurantId: string;
	restaurantSlug: string;
	theme: RestaurantTheme;
	brand: RestaurantBrand;
	/** Sorted menus (synthetic Carta if DB empty). */
	menus: Menu[];
	hasDbMenus: boolean;
	categories: Category[];
	tags: Tag[];
	products: Product[];
	/** product_id → menu_id[] from `menu_products`. */
	productMenuIds: Map<string, string[]>;
	/** product_id → tag_id[] from `product_tags`. */
	productTagIds: Map<string, string[]>;
};
