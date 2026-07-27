export type {
	Category,
	CategoryInsert,
	CategoryUpdate,
	JsonObject,
	Menu,
	MenuInsert,
	MenuProduct,
	MenuUpdate,
	OwnerRestaurant,
	Product,
	ProductInsert,
	ProductTag,
	ProductUpdate,
	Restaurant,
	RestaurantUpdate,
	Tag,
	TagInsert,
	TagUpdate,
} from "./types";

export {
	COLOR_MODE_COOKIE,
	COLOR_MODE_MAX_AGE,
	isDarkMode,
	parseColorMode,
	type ColorMode,
} from "./color-mode";

export { slugFromName, slugify } from "./slug";

export {
	DEFAULT_RESTAURANT_BRAND,
	brandFontByEtiqueta,
	brandFromFormData,
	brandHasColor,
	normalizeHex,
	parseRestaurantBrand,
	pickBrandFontEtiqueta,
	pickBrandHex,
	type BrandColor,
	type BrandFont,
	type RestaurantBrand,
} from "./restaurant-brand";

export {
	DEFAULT_RESTAURANT_THEME,
	FONT_OPTIONS,
	googleFontsHref,
	parseRestaurantTheme,
	restaurantThemeToCssVars,
	themeFromFormData,
	type RestaurantTheme,
	type ThemeMode,
	type ThemeRadius,
} from "./restaurant-theme";

export {
	CATEGORY_ICON_OPTIONS,
	isCategoryIconId,
	TAG_NAME_SUGGESTIONS,
	type CategoryIconId,
} from "./category-icons";
