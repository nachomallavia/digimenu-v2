/** Minimal menu template registry (Classic only through CP3). */

export type MenuTemplateMeta = {
	id: string;
	label: string;
	description: string;
};

export const DEFAULT_MENU_TEMPLATE_ID = "classic";

export const MENU_TEMPLATES: Record<string, MenuTemplateMeta> = {
	classic: {
		id: "classic",
		label: "Clásico",
		description:
			"Secciones por categoría con imágenes y TOC. Usa tokens de marca del restaurante.",
	},
};

export function resolveMenuTemplateId(raw: unknown): string {
	const id = typeof raw === "string" && raw.trim() ? raw.trim() : DEFAULT_MENU_TEMPLATE_ID;
	return MENU_TEMPLATES[id] ? id : DEFAULT_MENU_TEMPLATE_ID;
}

export function listMenuTemplates(): MenuTemplateMeta[] {
	return Object.values(MENU_TEMPLATES);
}

export function getMenuTemplateMeta(id: string): MenuTemplateMeta {
	return MENU_TEMPLATES[resolveMenuTemplateId(id)]!;
}
