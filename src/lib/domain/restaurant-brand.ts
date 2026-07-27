/**
 * Restaurant brand identity: curated color palette + typefaces.
 * Theme roles may only assign values from these lists.
 */

export type BrandColor = {
	hex: string;
	nombre: string;
};

export type BrandFont = {
	/** CSS font-family stack, e.g. `"DM Sans", sans-serif` */
	family: string;
	/** CSS font-weight, e.g. "400" or "700" */
	weight: string;
	/** Unique label shown in pickers */
	etiqueta: string;
};

export type RestaurantBrand = {
	colors: BrandColor[];
	fonts: BrandFont[];
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export const DEFAULT_RESTAURANT_BRAND: RestaurantBrand = {
	colors: [
		{ hex: "#1d4ed8", nombre: "Primario" },
		{ hex: "#ffffff", nombre: "Fondo" },
		{ hex: "#0a0a0a", nombre: "Texto" },
		{ hex: "#737373", nombre: "Texto suave" },
		{ hex: "#e5e5e5", nombre: "Borde" },
	],
	fonts: [
		{
			family: "ui-sans-serif, system-ui, sans-serif",
			weight: "400",
			etiqueta: "System Sans",
		},
		{
			family: "ui-serif, Georgia, serif",
			weight: "400",
			etiqueta: "System Serif",
		},
		{
			family: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
			weight: "400",
			etiqueta: "DM Sans",
		},
		{
			family: '"Source Serif 4", ui-serif, Georgia, serif',
			weight: "400",
			etiqueta: "Source Serif 4",
		},
		{
			family: '"Fraunces", ui-serif, Georgia, serif',
			weight: "500",
			etiqueta: "Fraunces",
		},
	],
};

export function normalizeHex(raw: unknown): string | null {
	if (typeof raw !== "string") return null;
	const value = raw.trim();
	if (!HEX_RE.test(value)) return null;
	return value.toLowerCase();
}

export function parseRestaurantBrand(raw: unknown): RestaurantBrand {
	if (!raw || typeof raw !== "object") {
		return {
			colors: DEFAULT_RESTAURANT_BRAND.colors.map((c) => ({ ...c })),
			fonts: DEFAULT_RESTAURANT_BRAND.fonts.map((f) => ({ ...f })),
		};
	}
	const o = raw as Record<string, unknown>;
	const colors: BrandColor[] = [];
	if (Array.isArray(o.colors)) {
		for (const item of o.colors) {
			if (!item || typeof item !== "object") continue;
			const row = item as Record<string, unknown>;
			const hex = normalizeHex(row.hex);
			const nombre =
				typeof row.nombre === "string"
					? row.nombre.trim()
					: typeof row.name === "string"
						? row.name.trim()
						: "";
			if (!hex || !nombre) continue;
			colors.push({ hex, nombre });
		}
	}
	const fonts: BrandFont[] = [];
	if (Array.isArray(o.fonts)) {
		for (const item of o.fonts) {
			if (!item || typeof item !== "object") continue;
			const row = item as Record<string, unknown>;
			const family = typeof row.family === "string" ? row.family.trim() : "";
			const weight =
				typeof row.weight === "number"
					? String(row.weight)
					: typeof row.weight === "string"
						? row.weight.trim()
						: "";
			const etiqueta =
				typeof row.etiqueta === "string"
					? row.etiqueta.trim()
					: typeof row.label === "string"
						? row.label.trim()
						: "";
			if (!family || !weight || !etiqueta) continue;
			fonts.push({ family, weight, etiqueta });
		}
	}
	return {
		colors: colors.length
			? colors
			: DEFAULT_RESTAURANT_BRAND.colors.map((c) => ({ ...c })),
		fonts: fonts.length
			? fonts
			: DEFAULT_RESTAURANT_BRAND.fonts.map((f) => ({ ...f })),
	};
}

/** Parse brand lists from multipart form (indexed fields). */
export function brandFromFormData(form: FormData): RestaurantBrand {
	const colorHexes = form.getAll("color_hex").map(String);
	const colorNombres = form.getAll("color_nombre").map(String);
	const colors: BrandColor[] = [];
	const nColors = Math.max(colorHexes.length, colorNombres.length);
	for (let i = 0; i < nColors; i++) {
		const hex = normalizeHex(colorHexes[i]);
		const nombre = (colorNombres[i] ?? "").trim();
		if (!hex || !nombre) continue;
		colors.push({ hex, nombre });
	}

	const fontFamilies = form.getAll("font_family").map(String);
	const fontWeights = form.getAll("font_weight").map(String);
	const fontEtiquetas = form.getAll("font_etiqueta").map(String);
	const fonts: BrandFont[] = [];
	const nFonts = Math.max(fontFamilies.length, fontWeights.length, fontEtiquetas.length);
	for (let i = 0; i < nFonts; i++) {
		const family = (fontFamilies[i] ?? "").trim();
		const weight = (fontWeights[i] ?? "").trim();
		const etiqueta = (fontEtiquetas[i] ?? "").trim();
		if (!family || !weight || !etiqueta) continue;
		fonts.push({ family, weight, etiqueta });
	}

	return {
		colors: colors.length
			? colors
			: DEFAULT_RESTAURANT_BRAND.colors.map((c) => ({ ...c })),
		fonts: fonts.length
			? fonts
			: DEFAULT_RESTAURANT_BRAND.fonts.map((f) => ({ ...f })),
	};
}

export function brandHasColor(brand: RestaurantBrand, hex: string): boolean {
	const n = normalizeHex(hex);
	if (!n) return false;
	return brand.colors.some((c) => c.hex === n);
}

export function brandFontByEtiqueta(
	brand: RestaurantBrand,
	etiqueta: string,
): BrandFont | undefined {
	const key = etiqueta.trim().toLowerCase();
	return brand.fonts.find((f) => f.etiqueta.toLowerCase() === key);
}

export function pickBrandHex(
	brand: RestaurantBrand,
	preferred: string,
	fallbackIndex = 0,
): string {
	const n = normalizeHex(preferred);
	if (n && brandHasColor(brand, n)) return n;
	return brand.colors[fallbackIndex]?.hex ?? DEFAULT_RESTAURANT_BRAND.colors[0]!.hex;
}

export function pickBrandFontEtiqueta(
	brand: RestaurantBrand,
	preferred: string,
	fallbackIndex = 0,
): string {
	if (brandFontByEtiqueta(brand, preferred)) return preferred.trim();
	return brand.fonts[fallbackIndex]?.etiqueta ?? DEFAULT_RESTAURANT_BRAND.fonts[0]!.etiqueta;
}
