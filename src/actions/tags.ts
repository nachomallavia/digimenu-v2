import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { isCategoryIconId, slugFromName } from "@/lib/domain";
import {
	createTag,
	deleteTag,
	getTagById,
	getTagBySlug,
	updateTag,
} from "@/lib/server/db";
import {
	bustPublicMenuCache,
	requireOwnerAction,
	toActionError,
} from "@/lib/server/owner";

function parseIcon(raw: string | null | undefined): string | null {
	const trimmed = raw?.trim() ?? "";
	if (!trimmed) return null;
	if (!isCategoryIconId(trimmed)) {
		throw new ActionError({ code: "BAD_REQUEST", message: "Icono inválido." });
	}
	return trimmed;
}

async function uniqueTagSlug(
	supabase: Parameters<typeof getTagBySlug>[0],
	restaurantId: string,
	name: string,
): Promise<string> {
	const base = slugFromName(name);
	let slug = base;
	let n = 2;
	while (await getTagBySlug(supabase, restaurantId, slug)) {
		slug = `${base}-${n++}`;
	}
	return slug;
}

async function ownedTag(
	supabase: Parameters<typeof getTagById>[0],
	restaurantId: string,
	id: string,
) {
	const row = await getTagById(supabase, id);
	if (!row || row.restaurant_id !== restaurantId) {
		throw new ActionError({ code: "NOT_FOUND", message: "Etiqueta no encontrada." });
	}
	return row;
}

export const tags = {
	create: defineAction({
		accept: "form",
		input: z.object({
			name: z.string().trim().min(1, "El nombre es obligatorio."),
			icon: z.string().nullable().optional(),
		}),
		handler: async (input, context) => {
			const owner = await requireOwnerAction(context);
			const supabase = context.locals.supabase;
			const restaurantId = owner.restaurant.id;

			try {
				const icon = parseIcon(input.icon);
				const slug = await uniqueTagSlug(supabase, restaurantId, input.name);
				const row = await createTag(supabase, {
					restaurant_id: restaurantId,
					slug,
					name: input.name,
					icon,
				});
				await bustPublicMenuCache(context, restaurantId);
				return { id: row.id, slug: row.slug };
			} catch (err) {
				toActionError(err, "No se pudo crear la etiqueta.");
			}
		},
	}),

	update: defineAction({
		accept: "form",
		input: z.object({
			id: z.string().uuid(),
			name: z.string().trim().min(1, "El nombre es obligatorio."),
			icon: z.string().nullable().optional(),
		}),
		handler: async (input, context) => {
			const owner = await requireOwnerAction(context);
			const supabase = context.locals.supabase;

			try {
				const current = await ownedTag(supabase, owner.restaurant.id, input.id);
				const icon = parseIcon(input.icon);
				const row = await updateTag(supabase, current.id, {
					name: input.name,
					icon,
				});
				await bustPublicMenuCache(context, owner.restaurant.id);
				return { id: row.id, slug: row.slug };
			} catch (err) {
				toActionError(err, "No se pudo actualizar la etiqueta.");
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
				const current = await ownedTag(supabase, owner.restaurant.id, id);
				// product_tags → ON DELETE CASCADE (no manual strip)
				await deleteTag(supabase, current.id);
				await bustPublicMenuCache(context, owner.restaurant.id);
				return { ok: true as const };
			} catch (err) {
				toActionError(err, "No se pudo eliminar la etiqueta.");
			}
		},
	}),
};
