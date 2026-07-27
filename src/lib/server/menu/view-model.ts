import { resolveMenuTemplateId, type Menu, type Product, type Tag } from "@/lib/domain";
import { productBelongsToMenuIds, type MenuBelongOpts } from "./membership";
import type {
	MenuProductView,
	MenuSectionView,
	MenuTagView,
	MenuViewModel,
	PublicRestaurantLoad,
} from "./types";

const priceFmt = new Intl.NumberFormat("es-AR", {
	style: "currency",
	currency: "ARS",
	maximumFractionDigits: 0,
});

const UNCATEGORIZED_ID = "sin-categoria";

export type BuildMenuViewModelInput = {
	loaded: PublicRestaurantLoad;
	activeMenu: Menu;
};

function logoForTheme(restaurant: PublicRestaurantLoad["restaurant"], mode: "light" | "dark") {
	if (mode === "dark") {
		return {
			logoUrl: restaurant.logo_dark_url ?? restaurant.logo_light_url,
			logoField: (restaurant.logo_dark_url
				? "logo_dark_url"
				: restaurant.logo_light_url
					? "logo_light_url"
					: null) as MenuViewModel["restaurant"]["logoField"],
		};
	}
	return {
		logoUrl: restaurant.logo_light_url ?? restaurant.logo_dark_url,
		logoField: (restaurant.logo_light_url
			? "logo_light_url"
			: restaurant.logo_dark_url
				? "logo_dark_url"
				: null) as MenuViewModel["restaurant"]["logoField"],
	};
}

export function buildMenuViewModel(input: BuildMenuViewModelInput): MenuViewModel {
	const { loaded, activeMenu } = input;
	const {
		restaurant,
		restaurantSlug,
		menus,
		categories,
		tags,
		products: allProducts,
		theme,
		hasDbMenus,
		productMenuIds,
		productTagIds,
	} = loaded;

	const soleMenuId = menus.length === 1 ? menus[0]!.id : undefined;
	const clientMenuSwitch = menus.length > 1;
	const belongOpts: MenuBelongOpts = {
		treatEmptyAsAll: !hasDbMenus,
		soleMenuId,
	};

	const menuIdsForProduct = (productId: string): string[] =>
		productMenuIds.get(productId) ?? [];

	const productsForPaint = clientMenuSwitch
		? allProducts
		: allProducts.filter((p) =>
				productBelongsToMenuIds(menuIdsForProduct(p.id), activeMenu.id, belongOpts),
			);

	const tagById = new Map(tags.map((t) => [t.id, t]));

	const toProductView = (p: Product): MenuProductView => {
		const tagIds = productTagIds.get(p.id) ?? [];
		const menuIds = menuIdsForProduct(p.id);
		const productTags: MenuTagView[] = tagIds
			.map((id) => tagById.get(id))
			.filter((t): t is Tag => !!t)
			.map((t) => ({
				id: t.id,
				name: t.name,
				icon: t.icon,
			}));
		return {
			id: p.id,
			name: p.name,
			price: p.price,
			priceLabel: priceFmt.format(p.price),
			description: p.description ?? null,
			imageUrl: p.image_url,
			categoryId: p.category_id ?? "",
			menuIds,
			inActiveMenu: productBelongsToMenuIds(menuIds, activeMenu.id, belongOpts),
			available: p.available,
			tags: productTags,
		};
	};

	const productViews = productsForPaint.map(toProductView);

	const byCategoryId = new Map<string, MenuProductView[]>();
	const uncategorized: MenuProductView[] = [];

	for (const product of productViews) {
		if (!product.categoryId) {
			uncategorized.push(product);
			continue;
		}
		const list = byCategoryId.get(product.categoryId) ?? [];
		list.push(product);
		byCategoryId.set(product.categoryId, list);
	}

	const sections: MenuSectionView[] = [];
	for (const cat of categories) {
		const items = byCategoryId.get(cat.id);
		if (items?.length) {
			sections.push({
				id: cat.id,
				slug: cat.slug,
				label: cat.name,
				icon: cat.icon,
				coverUrl: cat.cover_url,
				products: items,
			});
			byCategoryId.delete(cat.id);
		}
	}
	for (const items of byCategoryId.values()) {
		uncategorized.push(...items);
	}
	if (uncategorized.length) {
		sections.push({
			id: UNCATEGORIZED_ID,
			slug: UNCATEGORIZED_ID,
			label: "Sin categoría",
			products: uncategorized,
		});
	}

	const chipSource = clientMenuSwitch ? productViews : productViews.filter((p) => p.inActiveMenu);
	const filterCategories = sections
		.filter((s) => s.id !== UNCATEGORIZED_ID)
		.filter((s) => s.products.some((p) => (clientMenuSwitch ? true : p.inActiveMenu)))
		.map((s) => ({ id: s.id, label: s.label, icon: s.icon }));

	const usedTagIds = new Set<string>();
	for (const p of chipSource) {
		for (const t of p.tags) usedTagIds.add(t.id);
	}
	const filterTags: MenuTagView[] = tags
		.filter((t) => usedTagIds.has(t.id))
		.map((t) => ({
			id: t.id,
			name: t.name,
			icon: t.icon,
		}));

	const { logoUrl, logoField } = logoForTheme(restaurant, theme.mode);

	return {
		restaurantSlug,
		restaurant: {
			name: restaurant.name,
			description: restaurant.description ?? null,
			logoUrl,
			logoField,
		},
		menus: menus.map((m) => ({
			id: m.id,
			slug: m.slug,
			name: m.name,
			icon: m.icon ?? null,
		})),
		activeMenu: {
			id: activeMenu.id,
			slug: activeMenu.slug,
			name: activeMenu.name,
			template: resolveMenuTemplateId(activeMenu.template),
		},
		sections,
		products: productViews,
		filterCategories,
		filterTags,
		theme,
		clientMenuSwitch,
		hasDbMenus,
	};
}
