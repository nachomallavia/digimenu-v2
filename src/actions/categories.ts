import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { isCategoryIconId, slugFromName } from "@/lib/domain";
import {
	createCategory,
	deleteCategory,
	getCategoryById,
	getCategoryBySlug,
	listCategoriesByRestaurant,
	updateCategory,
} from "@/lib/server/db";
import {
	removeMediaByPublicUrl,
	requireOwnerAction,
	toActionError,
	uploadMedia,
} from "@/lib/server/owner";

const optionalFile = z
	.instanceof(File)
	.optional()
	.nullable()
	.transform((f) => (f && f.size > 0 ? f : null));

function parseIcon(raw: string | null | undefined): string | null {
	const trimmed = raw?.trim() ?? "";
	if (!trimmed) return null;
	if (!isCategoryIconId(trimmed)) {
		throw new ActionError({ code: "BAD_REQUEST", message: "Icono inválido." });
	}
	return trimmed;
}

async function uniqueCategorySlug(
	supabase: Parameters<typeof getCategoryBySlug>[0],
	restaurantId: string,
	name: string,
): Promise<string> {
	const base = slugFromName(name);
	let slug = base;
	let n = 2;
	while (await getCategoryBySlug(supabase, restaurantId, slug)) {
		slug = `${base}-${n++}`;
	}
	return slug;
}

async function ownedCategory(
	supabase: Parameters<typeof getCategoryById>[0],
	restaurantId: string,
	id: string,
) {
	const row = await getCategoryById(supabase, id);
	if (!row || row.restaurant_id !== restaurantId) {
		throw new ActionError({ code: "NOT_FOUND", message: "Categoría no encontrada." });
	}
	return row;
}

export const categories = {
	create: defineAction({
		accept: "form",
		input: z.object({
			name: z.string().trim().min(1, "El nombre es obligatorio."),
			icon: z.string().nullable().optional(),
			cover: optionalFile,
		}),
		handler: async (input, context) => {
			const owner = await requireOwnerAction(context);
			const supabase = context.locals.supabase;
			const restaurantId = owner.restaurant.id;

			try {
				const icon = parseIcon(input.icon);
				const slug = await uniqueCategorySlug(supabase, restaurantId, input.name);
				const existing = await listCategoriesByRestaurant(supabase, restaurantId);
				const maxOrder = existing.reduce((max, c) => Math.max(max, c.sort_order), -1);

				let cover_url: string | null = null;
				if (input.cover) {
					const uploaded = await uploadMedia(supabase, {
						restaurantId,
						kind: "categories",
						file: input.cover,
						stem: slug,
					});
					cover_url = uploaded.publicUrl;
				}

				const row = await createCategory(supabase, {
					restaurant_id: restaurantId,
					slug,
					name: input.name,
					icon,
					sort_order: maxOrder + 1,
					cover_url,
				});
				return { id: row.id, slug: row.slug };
			} catch (err) {
				toActionError(err, "No se pudo crear la categoría.");
			}
		},
	}),

	update: defineAction({
		accept: "form",
		input: z.object({
			id: z.string().uuid(),
			name: z.string().trim().min(1, "El nombre es obligatorio."),
			icon: z.string().nullable().optional(),
			cover: optionalFile,
			remove_cover: z.string().nullable().optional(),
		}),
		handler: async (input, context) => {
			const owner = await requireOwnerAction(context);
			const supabase = context.locals.supabase;
			const restaurantId = owner.restaurant.id;

			try {
				const current = await ownedCategory(supabase, restaurantId, input.id);
				const icon = parseIcon(input.icon);
				const removeCover = input.remove_cover === "1";

				let cover_url: string | null | undefined;
				let previousCover: string | null = null;

				if (removeCover) {
					cover_url = null;
					previousCover = current.cover_url;
				} else if (input.cover) {
					const uploaded = await uploadMedia(supabase, {
						restaurantId,
						kind: "categories",
						file: input.cover,
						stem: current.slug,
					});
					cover_url = uploaded.publicUrl;
					previousCover = current.cover_url;
				}

				const row = await updateCategory(supabase, current.id, {
					name: input.name,
					icon,
					...(cover_url !== undefined ? { cover_url } : {}),
				});

				if (previousCover && previousCover !== row.cover_url) {
					try {
						await removeMediaByPublicUrl(supabase, previousCover);
					} catch (err) {
						console.error("[categories.update] cover cleanup", err);
					}
				}

				return { id: row.id, slug: row.slug };
			} catch (err) {
				toActionError(err, "No se pudo actualizar la categoría.");
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

			try {
				const current = await ownedCategory(supabase, owner.restaurant.id, id);
				const coverUrl = current.cover_url;
				// products.category_id → ON DELETE SET NULL (no manual strip)
				await deleteCategory(supabase, current.id);
				if (coverUrl) {
					try {
						await removeMediaByPublicUrl(supabase, coverUrl);
					} catch (err) {
						console.error("[categories.delete] cover cleanup", err);
					}
				}
				return { ok: true as const };
			} catch (err) {
				toActionError(err, "No se pudo eliminar la categoría.");
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
				const list = await listCategoriesByRestaurant(supabase, restaurantId);
				const idx = list.findIndex((c) => c.id === id);
				if (idx < 0) {
					throw new ActionError({ code: "NOT_FOUND", message: "Categoría no encontrada." });
				}
				const swapWith = direction === "up" ? idx - 1 : idx + 1;
				if (swapWith < 0 || swapWith >= list.length) {
					return { ok: true as const };
				}

				const a = list[idx]!;
				const b = list[swapWith]!;
				const orderA = a.sort_order;
				const orderB = b.sort_order;

				await updateCategory(supabase, a.id, { sort_order: orderB });
				await updateCategory(supabase, b.id, { sort_order: orderA });
				return { ok: true as const };
			} catch (err) {
				toActionError(err, "No se pudo reordenar la categoría.");
			}
		},
	}),
};
