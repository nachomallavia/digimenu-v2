import {
	brandFontByEtiqueta,
	brandHasColor,
	DEFAULT_RESTAURANT_BRAND,
	pickBrandFontEtiqueta,
	pickBrandHex,
	type RestaurantBrand,
} from "./restaurant-brand";

export type ThemeMode = "light" | "dark";
export type ThemeRadius = "none" | "sm" | "md" | "lg";

/**
 * Semantic roles for the public menu shell.
 * Color fields are hex values that must exist in `restaurants.brand.colors`.
 * Font fields are brand font `etiqueta` values.
 */
export type RestaurantTheme = {
	mode: ThemeMode;
	primary: string;
	background: string;
	foreground: string;
	muted: string;
	border: string;
	radius: ThemeRadius;
	fontDisplay: string;
	fontBody: string;
};

/** Legacy DigiMenu catalog ids — kept for old content migration. */
export const FONT_OPTIONS = [
	{ id: "system-sans", label: "System Sans", family: "ui-sans-serif, system-ui, sans-serif" },
	{ id: "system-serif", label: "System Serif", family: "ui-serif, Georgia, serif" },
	{
		id: "dm-sans",
		label: "DM Sans",
		family: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
		google: "DM+Sans:wght@400;600;700",
	},
	{
		id: "source-serif",
		label: "Source Serif 4",
		family: '"Source Serif 4", ui-serif, Georgia, serif',
		google: "Source+Serif+4:wght@400;600;700",
	},
	{
		id: "fraunces",
		label: "Fraunces",
		family: '"Fraunces", ui-serif, Georgia, serif',
		google: "Fraunces:wght@500;700",
	},
] as const;

const RADIUS_MAP: Record<ThemeRadius, string> = {
	none: "0",
	sm: "0.25rem",
	md: "0.625rem",
	lg: "1rem",
};

export const DEFAULT_RESTAURANT_THEME: RestaurantTheme = {
	mode: "light",
	primary: "#1d4ed8",
	background: "#ffffff",
	foreground: "#0a0a0a",
	muted: "#737373",
	border: "#e5e5e5",
	radius: "md",
	fontDisplay: "System Sans",
	fontBody: "System Sans",
};

export function parseRestaurantTheme(raw: unknown): RestaurantTheme {
	if (!raw || typeof raw !== "object") return { ...DEFAULT_RESTAURANT_THEME };
	const o = raw as Record<string, unknown>;
	const mode: ThemeMode = o.mode === "dark" ? "dark" : "light";
	const radius =
		o.radius === "none" || o.radius === "sm" || o.radius === "lg" || o.radius === "md"
			? o.radius
			: "md";

	const legacyFontLabel = (value: unknown, fallback: string): string => {
		if (typeof value !== "string" || !value.trim()) return fallback;
		const id = value.trim();
		const legacy = FONT_OPTIONS.find((f) => f.id === id);
		return legacy ? legacy.label : id;
	};

	return {
		mode,
		primary: typeof o.primary === "string" ? o.primary : DEFAULT_RESTAURANT_THEME.primary,
		background:
			typeof o.background === "string" ? o.background : DEFAULT_RESTAURANT_THEME.background,
		foreground:
			typeof o.foreground === "string" ? o.foreground : DEFAULT_RESTAURANT_THEME.foreground,
		muted: typeof o.muted === "string" ? o.muted : DEFAULT_RESTAURANT_THEME.muted,
		border: typeof o.border === "string" ? o.border : DEFAULT_RESTAURANT_THEME.border,
		radius,
		fontDisplay: legacyFontLabel(o.fontDisplay, DEFAULT_RESTAURANT_THEME.fontDisplay),
		fontBody: legacyFontLabel(o.fontBody, DEFAULT_RESTAURANT_THEME.fontBody),
	};
}

/** Parse public-menu theme roles from owner form (must resolve against brand). */
export function themeFromFormData(form: FormData, brand: RestaurantBrand): RestaurantTheme {
	const mode = (
		String(form.get("mode") ?? "light") === "dark" ? "dark" : "light"
	) as ThemeMode;
	const radiusRaw = String(form.get("radius") ?? "md");
	const radius = (
		["none", "sm", "md", "lg"].includes(radiusRaw) ? radiusRaw : "md"
	) as ThemeRadius;

	const roleHex = (name: string, fallback: string, index: number): string => {
		const value = String(form.get(name) ?? "")
			.trim()
			.toLowerCase();
		if (brandHasColor(brand, value)) return value;
		return pickBrandHex(brand, fallback, index);
	};

	const roleFont = (name: string, fallback: string, index: number): string => {
		const value = String(form.get(name) ?? "").trim();
		if (brandFontByEtiqueta(brand, value)) return value;
		return pickBrandFontEtiqueta(brand, fallback, index);
	};

	return {
		mode,
		primary: roleHex("primary", DEFAULT_RESTAURANT_THEME.primary, 0),
		background: roleHex("background", DEFAULT_RESTAURANT_THEME.background, 1),
		foreground: roleHex("foreground", DEFAULT_RESTAURANT_THEME.foreground, 2),
		muted: roleHex("muted", DEFAULT_RESTAURANT_THEME.muted, 3),
		border: roleHex("border", DEFAULT_RESTAURANT_THEME.border, 4),
		radius,
		fontDisplay: roleFont("fontDisplay", DEFAULT_RESTAURANT_THEME.fontDisplay, 0),
		fontBody: roleFont("fontBody", DEFAULT_RESTAURANT_THEME.fontBody, 0),
	};
}

function resolveFontFamily(etiqueta: string, brand: RestaurantBrand): string {
	const fromBrand = brandFontByEtiqueta(brand, etiqueta);
	if (fromBrand) return fromBrand.family;
	const legacy = FONT_OPTIONS.find(
		(f) => f.id === etiqueta || f.label.toLowerCase() === etiqueta.toLowerCase(),
	);
	return legacy?.family ?? DEFAULT_RESTAURANT_BRAND.fonts[0]!.family;
}

function resolveFontWeight(etiqueta: string, brand: RestaurantBrand): string {
	const fromBrand = brandFontByEtiqueta(brand, etiqueta);
	if (fromBrand) return fromBrand.weight;
	return "400";
}

/** First quoted family name inside a CSS stack, for Google Fonts. */
function googleFamilyFromStack(family: string): string | null {
	const match = family.match(/"([^"]+)"|'([^']+)'/);
	return match?.[1] ?? match?.[2] ?? null;
}

export function restaurantThemeToCssVars(
	theme: RestaurantTheme,
	brand: RestaurantBrand = DEFAULT_RESTAURANT_BRAND,
): Record<string, string> {
	const displayFamily = resolveFontFamily(theme.fontDisplay, brand);
	const bodyFamily = resolveFontFamily(theme.fontBody, brand);
	const displayWeight = resolveFontWeight(theme.fontDisplay, brand);
	const bodyWeight = resolveFontWeight(theme.fontBody, brand);

	return {
		background: theme.background,
		foreground: theme.foreground,
		primary: theme.primary,
		"primary-foreground": "#fafafa",
		muted: theme.mode === "dark" ? "#262626" : "#f5f5f5",
		"muted-foreground": theme.muted,
		border: theme.border,
		card: theme.background,
		"card-foreground": theme.foreground,
		radius: RADIUS_MAP[theme.radius],
		"font-display": displayFamily,
		"font-body": bodyFamily,
		"font-display-weight": displayWeight,
		"font-body-weight": bodyWeight,
	};
}

export function googleFontsHref(
	theme: RestaurantTheme,
	brand: RestaurantBrand = DEFAULT_RESTAURANT_BRAND,
): string | null {
	const etiquetas = [theme.fontDisplay, theme.fontBody];
	const families = new Map<string, Set<string>>();

	for (const etiqueta of etiquetas) {
		const font = brandFontByEtiqueta(brand, etiqueta);
		const familyStack = font?.family ?? resolveFontFamily(etiqueta, brand);
		const googleName = googleFamilyFromStack(familyStack);
		if (!googleName) continue;
		const weight = font?.weight ?? "400";
		const set = families.get(googleName) ?? new Set<string>();
		set.add(weight);
		families.set(googleName, set);
	}

	if (families.size === 0) return null;
	const parts = [...families.entries()].map(([name, weights]) => {
		const w = [...weights].sort().join(";");
		return `family=${encodeURIComponent(name)}:wght@${w}`;
	});
	return `https://fonts.googleapis.com/css2?${parts.join("&")}&display=swap`;
}
