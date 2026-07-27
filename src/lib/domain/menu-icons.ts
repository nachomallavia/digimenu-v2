/** Curated Tabler outline icon ids for menu pickers (landing / Inicio). */
export const MENU_ICON_OPTIONS = [
	{ id: "tools-kitchen-2", label: "Carta" },
	{ id: "chef-hat", label: "Cocina" },
	{ id: "sun", label: "Almuerzo" },
	{ id: "moon", label: "Cena" },
	{ id: "coffee", label: "Café" },
	{ id: "cup", label: "Taza" },
	{ id: "glass-full", label: "Vinos" },
	{ id: "beer", label: "Cerveza" },
	{ id: "bottle", label: "Botella" },
	{ id: "pizza", label: "Pizza" },
	{ id: "salad", label: "Ensalada" },
	{ id: "soup", label: "Sopa" },
	{ id: "meat", label: "Carne" },
	{ id: "fish", label: "Pescado" },
	{ id: "cake", label: "Postre" },
	{ id: "star", label: "Destacado" },
] as const;

export type MenuIconId = (typeof MENU_ICON_OPTIONS)[number]["id"];

const ICON_IDS = new Set<string>(MENU_ICON_OPTIONS.map((o) => o.id));

export function isMenuIconId(value: string): value is MenuIconId {
	return ICON_IDS.has(value);
}

/** Static suggestion chips for menu create forms. */
export const MENU_NAME_SUGGESTIONS = [
	"Carta",
	"Almuerzo",
	"Cena",
	"Café",
	"Vinos",
	"Bebidas",
] as const;
