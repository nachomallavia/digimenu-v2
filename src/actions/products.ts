import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { slugFromName } from "@/lib/domain";
import {
	createProduct,
	deleteProduct,
	getCategoryById,
	getMenuById,
	getProductById,
	getProductBySlug,
	getTagById,
	setProductTags,
	updateProduct,
} from "@/lib/server/db";
import {
	batchUpdateProducts,
	removeMediaByPublicUrl,
	requireOwnerAction,
	syncProductMenuMembership,
	toActionError,
	uploadMedia,
} from "@/lib/server/owner";

const optionalFile = z
	.instanceof(File)
	.optional()
	.nullable()
	.transform((f) => (f && f.size > 0 ? f : null));

const uuidList = z
	.union([z.string().uuid(), z.array(z.string().uuid())])
	.optional()
	.transform((v) => {
		if (v == null) return [] as string[];
		return Array.isArray(v) ? v : [v];
	});

function parsePrice(raw: string | number): number {
	const n = typeof raw === "number" ? raw : Number(String(raw).trim());
	if (!Number.isFinite(n) || n < 0) {
		throw new ActionError({
			code: "BAD_REQUEST",
			message: "Precio inválido.",
		});
	}
	return Math.round(n * 100) / 100;
}

async function uniqueProductSlug(
	supabase: Parameters<typeof getProductBySlug>[0],
	restaurantId: string,
	name: string,
): Promise<string> {
	const base = slugFromName(name);
	let slug = base;
	let n = 2;
	while (await getProductBySlug(supabase, restaurantId, slug)) {
		slug = `${base}-${n++}`;
	}
	return slug;
}

async function ownedProduct(
	supabase: Parameters<typeof getProductById>[0],
	restaurantId: string,
	id: string,
) {
	const row = await getProductById(supabase, id);
	if (!row || row.restaurant_id !== restaurantId) {
		throw new ActionError({ code: "NOT_FOUND", message: "Producto no encontrado." });
	}
	return row;
}

async function resolveCategoryId(
	supabase: Parameters<typeof getCategoryById>[0],
	restaurantId: string,
	raw: string | null | undefined,
): Promise<string | null> {
	const id = raw?.trim() || "";
	if (!id) return null;
	const cat = await getCategoryById(supabase, id);
	if (!cat || cat.restaurant_id !== restaurantId) {
		throw new ActionError({ code: "BAD_REQUEST", message: "Categoría inválida." });
	}
	return cat.id;
}

async function resolveTagIds(
	supabase: Parameters<typeof getTagById>[0],
	restaurantId: string,
	ids: string[],
): Promise<string[]> {
	const out: string[] = [];
	for (const id of ids) {
		const tag = await getTagById(supabase, id);
		if (!tag || tag.restaurant_id !== restaurantId) {
			throw new ActionError({ code: "BAD_REQUEST", message: "Etiqueta inválida." });
		}
		out.push(tag.id);
	}
	return out;
}

async function resolveMenuIds(
	supabase: Parameters<typeof getMenuById>[0],
	restaurantId: string,
	ids: string[],
): Promise<string[]> {
	const out: string[] = [];
	for (const id of ids) {
		const menu = await getMenuById(supabase, id);
		if (!menu || menu.restaurant_id !== restaurantId) {
			throw new ActionError({ code: "BAD_REQUEST", message: "Menú inválido." });
		}
		out.push(menu.id);
	}
	return out;
}

export const products = {
	create: defineAction({
		accept: "form",
		input: z.object({
			name: z.string().trim().min(1, "El nombre es obligatorio."),
			price: z.string().trim().min(1, "El precio es obligatorio."),
			description: z.string().nullable().optional(),
			category_id: z.string().nullable().optional(),
			image: optionalFile,
			tags: uuidList,
			menus: uuidList,
			available: z.string().nullable().optional(),
			active: z.string().nullable().optional(),
		}),
		handler: async (input, context) => {
			const owner = await requireOwnerAction(context);
			const supabase = context.locals.supabase;
			const restaurantId = owner.restaurant.id;

			try {
				const price = parsePrice(input.price);
				const category_id = await resolveCategoryId(
					supabase,
					restaurantId,
					input.category_id,
				);
				const tagIds = await resolveTagIds(supabase, restaurantId, input.tags);
				const menuIds = await resolveMenuIds(supabase, restaurantId, input.menus);
				const slug = await uniqueProductSlug(supabase, restaurantId, input.name);
				const description = input.description?.trim() || null;
				const available = input.available === "1";
				const active = input.active === "1";

				let image_url: string | null = null;
				if (input.image) {
					const uploaded = await uploadMedia(supabase, {
						restaurantId,
						kind: "products",
						file: input.image,
						stem: slug,
					});
					image_url = uploaded.publicUrl;
				}

				const row = await createProduct(supabase, {
					restaurant_id: restaurantId,
					slug,
					name: input.name,
					description,
					price,
					category_id,
					image_url,
					available,
					active,
				});

				if (tagIds.length > 0) {
					await setProductTags(supabase, restaurantId, row.id, tagIds);
				}
				if (menuIds.length > 0) {
					await syncProductMenuMembership(supabase, restaurantId, row.id, menuIds);
				}

				return { id: row.id, slug: row.slug };
			} catch (err) {
				toActionError(err, "No se pudo crear el producto.");
			}
		},
	}),

	update: defineAction({
		accept: "form",
		input: z.object({
			id: z.string().uuid(),
			name: z.string().trim().min(1, "El nombre es obligatorio."),
			price: z.string().trim().min(1, "El precio es obligatorio."),
			description: z.string().nullable().optional(),
			category_id: z.string().nullable().optional(),
			image: optionalFile,
			remove_image: z.string().nullable().optional(),
			tags: uuidList,
			menus: uuidList,
			available: z.string().nullable().optional(),
			active: z.string().nullable().optional(),
		}),
		handler: async (input, context) => {
			const owner = await requireOwnerAction(context);
			const supabase = context.locals.supabase;
			const restaurantId = owner.restaurant.id;

			try {
				const current = await ownedProduct(supabase, restaurantId, input.id);
				const price = parsePrice(input.price);
				const category_id = await resolveCategoryId(
					supabase,
					restaurantId,
					input.category_id,
				);
				const tagIds = await resolveTagIds(supabase, restaurantId, input.tags);
				const menuIds = await resolveMenuIds(supabase, restaurantId, input.menus);
				const description = input.description?.trim() || null;
				const available = input.available === "1";
				const active = input.active === "1";
				const removeImage = input.remove_image === "1";

				let image_url: string | null | undefined;
				let previousImage: string | null = null;

				if (removeImage) {
					image_url = null;
					previousImage = current.image_url;
				} else if (input.image) {
					const uploaded = await uploadMedia(supabase, {
						restaurantId,
						kind: "products",
						file: input.image,
						stem: current.slug,
					});
					image_url = uploaded.publicUrl;
					previousImage = current.image_url;
				}

				const row = await updateProduct(supabase, current.id, {
					name: input.name,
					price,
					description,
					category_id,
					available,
					active,
					...(image_url !== undefined ? { image_url } : {}),
				});

				await setProductTags(supabase, restaurantId, row.id, tagIds);
				await syncProductMenuMembership(supabase, restaurantId, row.id, menuIds);

				if (previousImage && previousImage !== row.image_url) {
					try {
						await removeMediaByPublicUrl(supabase, previousImage);
					} catch (err) {
						console.error("[products.update] image cleanup", err);
					}
				}

				return { id: row.id, slug: row.slug };
			} catch (err) {
				toActionError(err, "No se pudo actualizar el producto.");
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
				const current = await ownedProduct(supabase, owner.restaurant.id, id);
				const imageUrl = current.image_url;
				// menu_products / product_tags → ON DELETE CASCADE
				await deleteProduct(supabase, current.id);
				if (imageUrl) {
					try {
						await removeMediaByPublicUrl(supabase, imageUrl);
					} catch (err) {
						console.error("[products.delete] image cleanup", err);
					}
				}
				return { ok: true as const };
			} catch (err) {
				toActionError(err, "No se pudo eliminar el producto.");
			}
		},
	}),

	/** JSON delete for list UI (same ownership checks). */
	deleteJson: defineAction({
		accept: "json",
		input: z.object({
			id: z.string().uuid(),
		}),
		handler: async ({ id }, context) => {
			const owner = await requireOwnerAction(context);
			const supabase = context.locals.supabase;

			try {
				const current = await ownedProduct(supabase, owner.restaurant.id, id);
				const imageUrl = current.image_url;
				await deleteProduct(supabase, current.id);
				if (imageUrl) {
					try {
						await removeMediaByPublicUrl(supabase, imageUrl);
					} catch (err) {
						console.error("[products.deleteJson] image cleanup", err);
					}
				}
				return { ok: true as const };
			} catch (err) {
				toActionError(err, "No se pudo eliminar el producto.");
			}
		},
	}),

	batchUpdate: defineAction({
		accept: "json",
		input: z.object({
			changes: z.record(
				z.string().uuid(),
				z.object({
					name: z.string().optional(),
					price: z.number().optional(),
					category_id: z.string().uuid().nullable().optional(),
				}),
			),
		}),
		handler: async ({ changes }, context) => {
			const owner = await requireOwnerAction(context);
			const supabase = context.locals.supabase;

			try {
				const result = await batchUpdateProducts(
					supabase,
					owner.restaurant.id,
					changes,
				);
				return result;
			} catch (err) {
				toActionError(err, "No se pudieron guardar los cambios.");
			}
		},
	}),

	uploadImage: defineAction({
		accept: "form",
		input: z.object({
			id: z.string().uuid(),
			image: z.instanceof(File),
		}),
		handler: async (input, context) => {
			const owner = await requireOwnerAction(context);
			const supabase = context.locals.supabase;
			const restaurantId = owner.restaurant.id;

			try {
				if (!(input.image instanceof File) || input.image.size <= 0) {
					throw new ActionError({
						code: "BAD_REQUEST",
						message: "Imagen requerida.",
					});
				}
				const current = await ownedProduct(supabase, restaurantId, input.id);
				const uploaded = await uploadMedia(supabase, {
					restaurantId,
					kind: "products",
					file: input.image,
					stem: current.slug,
				});
				const row = await updateProduct(supabase, current.id, {
					image_url: uploaded.publicUrl,
				});
				if (current.image_url && current.image_url !== row.image_url) {
					try {
						await removeMediaByPublicUrl(supabase, current.image_url);
					} catch (err) {
						console.error("[products.uploadImage] cleanup", err);
					}
				}
				return { ok: true as const, image_url: row.image_url };
			} catch (err) {
				toActionError(err, "No se pudo subir la imagen.");
			}
		},
	}),

	removeImage: defineAction({
		accept: "form",
		input: z.object({
			id: z.string().uuid(),
		}),
		handler: async ({ id }, context) => {
			const owner = await requireOwnerAction(context);
			const supabase = context.locals.supabase;

			try {
				const current = await ownedProduct(supabase, owner.restaurant.id, id);
				if (!current.image_url) {
					return { ok: true as const };
				}
				await updateProduct(supabase, current.id, { image_url: null });
				try {
					await removeMediaByPublicUrl(supabase, current.image_url);
				} catch (err) {
					console.error("[products.removeImage] cleanup", err);
				}
				return { ok: true as const };
			} catch (err) {
				toActionError(err, "No se pudo quitar la imagen.");
			}
		},
	}),

	setTags: defineAction({
		accept: "json",
		input: z.object({
			productId: z.string().uuid(),
			tagIds: z.array(z.string().uuid()),
		}),
		handler: async ({ productId, tagIds }, context) => {
			const owner = await requireOwnerAction(context);
			const supabase = context.locals.supabase;
			const restaurantId = owner.restaurant.id;

			try {
				await ownedProduct(supabase, restaurantId, productId);
				const ownedTags = await resolveTagIds(supabase, restaurantId, tagIds);
				const rows = await setProductTags(
					supabase,
					restaurantId,
					productId,
					ownedTags,
				);
				return { ok: true as const, count: rows.length };
			} catch (err) {
				toActionError(err, "No se pudieron actualizar las etiquetas.");
			}
		},
	}),

	setMenus: defineAction({
		accept: "json",
		input: z.object({
			productId: z.string().uuid(),
			menuIds: z.array(z.string().uuid()),
		}),
		handler: async ({ productId, menuIds }, context) => {
			const owner = await requireOwnerAction(context);
			const supabase = context.locals.supabase;
			const restaurantId = owner.restaurant.id;

			try {
				await ownedProduct(supabase, restaurantId, productId);
				const ownedMenus = await resolveMenuIds(supabase, restaurantId, menuIds);
				await syncProductMenuMembership(
					supabase,
					restaurantId,
					productId,
					ownedMenus,
				);
				return { ok: true as const, count: ownedMenus.length };
			} catch (err) {
				toActionError(err, "No se pudieron actualizar los menús.");
			}
		},
	}),
};
