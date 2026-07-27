import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import {
	isMenuIconId,
	resolveMenuTemplateId,
	slugFromName,
} from "@/lib/domain";
import {
	createMenu,
	deleteMenu,
	getMenuById,
	getMenuBySlug,
	listMenusByRestaurant,
	listProductsByRestaurant,
	setMenuProducts,
	updateMenu,
} from "@/lib/server/db";
import { requireOwnerAction, toActionError } from "@/lib/server/owner";

function parseIcon(raw: string | null | undefined): string | null {
	const trimmed = raw?.trim() ?? "";
	if (!trimmed) return null;
	if (!isMenuIconId(trimmed)) {
		throw new ActionError({ code: "BAD_REQUEST", message: "Icono inválido." });
	}
	return trimmed;
}

async function uniqueMenuSlug(
	supabase: Parameters<typeof getMenuBySlug>[0],
	restaurantId: string,
	name: string,
): Promise<string> {
	const base = slugFromName(name);
	let slug = base;
	let n = 2;
	while (await getMenuBySlug(supabase, restaurantId, slug)) {
		slug = `${base}-${n++}`;
	}
	return slug;
}

async function ownedMenu(
	supabase: Parameters<typeof getMenuById>[0],
	restaurantId: string,
	id: string,
) {
	const row = await getMenuById(supabase, id);
	if (!row || row.restaurant_id !== restaurantId) {
		throw new ActionError({ code: "NOT_FOUND", message: "Menú no encontrado." });
	}
	return row;
}

export const menus = {
	create: defineAction({
		accept: "form",
		input: z.object({
			name: z.string().trim().min(1, "El nombre es obligatorio."),
			description: z.string().nullable().optional(),
			icon: z.string().nullable().optional(),
			template: z.string().nullable().optional(),
		}),
		handler: async (input, context) => {
			const owner = await requireOwnerAction(context);
			const supabase = context.locals.supabase;
			const restaurantId = owner.restaurant.id;

			try {
				const icon = parseIcon(input.icon);
				const template = resolveMenuTemplateId(input.template);
				const slug = await uniqueMenuSlug(supabase, restaurantId, input.name);
				const existing = await listMenusByRestaurant(supabase, restaurantId);
				const maxOrder = existing.reduce((max, m) => Math.max(max, m.sort_order), -1);
				const description = input.description?.trim() || null;

				const row = await createMenu(supabase, {
					restaurant_id: restaurantId,
					slug,
					name: input.name,
					description,
					icon,
					template,
					sort_order: maxOrder + 1,
				});
				return { id: row.id, slug: row.slug };
			} catch (err) {
				toActionError(err, "No se pudo crear el menú.");
			}
		},
	}),

	update: defineAction({
		accept: "form",
		input: z.object({
			id: z.string().uuid(),
			name: z.string().trim().min(1, "El nombre es obligatorio."),
			description: z.string().nullable().optional(),
			icon: z.string().nullable().optional(),
			template: z.string().nullable().optional(),
		}),
		handler: async (input, context) => {
			const owner = await requireOwnerAction(context);
			const supabase = context.locals.supabase;

			try {
				const current = await ownedMenu(supabase, owner.restaurant.id, input.id);
				const icon = parseIcon(input.icon);
				const description = input.description?.trim() || null;
				const patch: {
					name: string;
					description: string | null;
					icon: string | null;
					template?: string;
				} = {
					name: input.name,
					description,
					icon,
				};
				if (input.template != null && String(input.template).trim() !== "") {
					patch.template = resolveMenuTemplateId(input.template);
				}

				const row = await updateMenu(supabase, current.id, patch);
				return { id: row.id, slug: row.slug };
			} catch (err) {
				toActionError(err, "No se pudo actualizar el menú.");
			}
		},
	}),

	delete: defineAction({
		accept: "form",
		input: z.object({
			id: z.string().uuid(),
		}),
		handler: async ({ id }, context) => {
			const owner = await requireOwnerAction(context);
			const supabase = context.locals.supabase;
			const restaurantId = owner.restaurant.id;

			try {
				const current = await ownedMenu(supabase, restaurantId, id);
				const menusList = await listMenusByRestaurant(supabase, restaurantId);
				if (menusList.length <= 1) {
					throw new ActionError({
						code: "BAD_REQUEST",
						message: "No se puede borrar el único menú del restaurante.",
					});
				}
				// menu_products → ON DELETE CASCADE
				await deleteMenu(supabase, current.id);
				return { ok: true as const };
			} catch (err) {
				toActionError(err, "No se pudo eliminar el menú.");
			}
		},
	}),

	move: defineAction({
		accept: "form",
		input: z.object({
			id: z.string().uuid(),
			direction: z.enum(["up", "down"]),
		}),
		handler: async ({ id, direction }, context) => {
			const owner = await requireOwnerAction(context);
			const supabase = context.locals.supabase;
			const restaurantId = owner.restaurant.id;

			try {
				const list = await listMenusByRestaurant(supabase, restaurantId);
				const idx = list.findIndex((m) => m.id === id);
				if (idx < 0) {
					throw new ActionError({ code: "NOT_FOUND", message: "Menú no encontrado." });
				}
				const swapWith = direction === "up" ? idx - 1 : idx + 1;
				if (swapWith < 0 || swapWith >= list.length) {
					return { ok: true as const };
				}

				const a = list[idx]!;
				const b = list[swapWith]!;
				await updateMenu(supabase, a.id, { sort_order: b.sort_order });
				await updateMenu(supabase, b.id, { sort_order: a.sort_order });
				return { ok: true as const };
			} catch (err) {
				toActionError(err, "No se pudo reordenar el menú.");
			}
		},
	}),

	setProducts: defineAction({
		accept: "json",
		input: z.object({
			menuId: z.string().uuid(),
			productIds: z.array(z.string().uuid()),
		}),
		handler: async ({ menuId, productIds }, context) => {
			const owner = await requireOwnerAction(context);
			const supabase = context.locals.supabase;
			const restaurantId = owner.restaurant.id;

			try {
				await ownedMenu(supabase, restaurantId, menuId);
				const products = await listProductsByRestaurant(supabase, restaurantId);
				const owned = new Set(products.map((p) => p.id));
				const ordered = [
					...new Set(productIds.filter((id) => owned.has(id))),
				];
				const rows = await setMenuProducts(supabase, restaurantId, menuId, ordered);
				return { ok: true as const, count: rows.length };
			} catch (err) {
				toActionError(err, "No se pudo actualizar la lista de productos.");
			}
		},
	}),
};
