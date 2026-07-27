import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import {
	brandFromFormData,
	parseRestaurantBrand,
	themeFromFormData,
	type JsonObject,
} from "@/lib/domain";
import { getRestaurantById, updateRestaurant } from "@/lib/server/db";
import {
	removeMediaByPublicUrl,
	requireOwnerAction,
	toActionError,
	uploadMedia,
} from "@/lib/server/owner";

const logoModeSchema = z.enum(["light", "dark"]);

function logoUrlColumn(mode: "light" | "dark"): "logo_light_url" | "logo_dark_url" {
	return mode === "light" ? "logo_light_url" : "logo_dark_url";
}

export const restaurant = {
	updateBasics: defineAction({
		accept: "form",
		input: z.object({
			name: z.string().trim().min(1, "El nombre es obligatorio."),
			description: z
				.string()
				.nullable()
				.optional()
				.transform((v) => {
					if (v == null) return null;
					const trimmed = v.trim();
					return trimmed.length > 0 ? trimmed : null;
				}),
		}),
		handler: async (input, context) => {
			const owner = await requireOwnerAction(context);
			try {
				await updateRestaurant(context.locals.supabase, owner.restaurant.id, {
					name: input.name,
					description: input.description ?? null,
				});
				return { ok: true as const, section: "basics" as const };
			} catch (err) {
				toActionError(err, "No se pudieron guardar los datos.");
			}
		},
	}),

	updateBrandTheme: defineAction({
		accept: "form",
		handler: async (formData, context) => {
			const owner = await requireOwnerAction(context);
			const part = String(formData.get("part") ?? "").trim();

			try {
				const current = await getRestaurantById(context.locals.supabase, owner.restaurant.id);
				if (!current) {
					throw new ActionError({
						code: "NOT_FOUND",
						message: "No se encontró el restaurante.",
					});
				}

				if (part === "brand") {
					const brand = brandFromFormData(formData);
					await updateRestaurant(context.locals.supabase, owner.restaurant.id, {
						brand: brand as unknown as JsonObject,
					});
					return { ok: true as const, section: "brand" as const };
				}

				if (part === "theme") {
					const brand = parseRestaurantBrand(current.brand);
					const theme = themeFromFormData(formData, brand);
					await updateRestaurant(context.locals.supabase, owner.restaurant.id, {
						theme: theme as unknown as JsonObject,
					});
					return { ok: true as const, section: "theme" as const };
				}

				throw new ActionError({
					code: "BAD_REQUEST",
					message: "Sección inválida (marca o tema).",
				});
			} catch (err) {
				toActionError(err, "No se pudo guardar la identidad.");
			}
		},
	}),

	uploadLogo: defineAction({
		accept: "form",
		input: z.object({
			mode: logoModeSchema,
			file: z
				.instanceof(File)
				.refine((f) => f.size > 0, "Elegí una imagen para subir."),
		}),
		handler: async (input, context) => {
			const owner = await requireOwnerAction(context);
			const column = logoUrlColumn(input.mode);
			const supabase = context.locals.supabase;

			try {
				const current = await getRestaurantById(supabase, owner.restaurant.id);
				if (!current) {
					throw new ActionError({
						code: "NOT_FOUND",
						message: "No se encontró el restaurante.",
					});
				}

				const previousUrl = current[column];
				const { publicUrl } = await uploadMedia(supabase, {
					restaurantId: owner.restaurant.id,
					kind: "logos",
					file: input.file,
					stem: input.mode,
				});

				await updateRestaurant(supabase, owner.restaurant.id, {
					[column]: publicUrl,
				});

				if (previousUrl && previousUrl !== publicUrl) {
					try {
						await removeMediaByPublicUrl(supabase, previousUrl);
					} catch (cleanupErr) {
						console.error("[restaurant.uploadLogo] cleanup", cleanupErr);
					}
				}

				return { ok: true as const, mode: input.mode, publicUrl };
			} catch (err) {
				toActionError(err, "No se pudo subir el logo.");
			}
		},
	}),

	removeLogo: defineAction({
		accept: "form",
		input: z.object({
			mode: logoModeSchema,
		}),
		handler: async (input, context) => {
			const owner = await requireOwnerAction(context);
			const column = logoUrlColumn(input.mode);
			const supabase = context.locals.supabase;

			try {
				const current = await getRestaurantById(supabase, owner.restaurant.id);
				if (!current) {
					throw new ActionError({
						code: "NOT_FOUND",
						message: "No se encontró el restaurante.",
					});
				}

				const previousUrl = current[column];
				await updateRestaurant(supabase, owner.restaurant.id, {
					[column]: null,
				});

				if (previousUrl) {
					try {
						await removeMediaByPublicUrl(supabase, previousUrl);
					} catch (cleanupErr) {
						console.error("[restaurant.removeLogo] cleanup", cleanupErr);
					}
				}

				return { ok: true as const, mode: input.mode };
			} catch (err) {
				toActionError(err, "No se pudo quitar el logo.");
			}
		},
	}),
};
