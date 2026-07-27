import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProductUpdate } from "@/lib/domain";
import {
	getCategoryById,
	getProductById,
	updateProduct,
} from "@/lib/server/db";

export type ProductBatchPatch = {
	name?: string;
	price?: number;
	category_id?: string | null;
};

export type ProductBatchResult = {
	ok: boolean;
	updated: number;
	failed: { id: string; error: string }[];
};

/**
 * Apply inline list edits (name / price / category) for owned products.
 * Continues on per-row failure; returns partial success summary.
 */
export async function batchUpdateProducts(
	supabase: SupabaseClient,
	restaurantId: string,
	changes: Record<string, ProductBatchPatch>,
): Promise<ProductBatchResult> {
	const failed: { id: string; error: string }[] = [];
	let updated = 0;

	for (const [id, patch] of Object.entries(changes)) {
		try {
			const row = await getProductById(supabase, id);
			if (!row || row.restaurant_id !== restaurantId) {
				failed.push({ id, error: "Producto no encontrado." });
				continue;
			}

			const next: ProductUpdate = {};

			if (patch.name !== undefined) {
				const name = patch.name.trim();
				if (!name) {
					failed.push({ id, error: "Nombre obligatorio." });
					continue;
				}
				next.name = name;
			}

			if (patch.price !== undefined) {
				if (!Number.isFinite(patch.price) || patch.price < 0) {
					failed.push({ id, error: "Precio inválido." });
					continue;
				}
				next.price = Math.round(patch.price * 100) / 100;
			}

			if (patch.category_id !== undefined) {
				if (patch.category_id === null || patch.category_id === "") {
					next.category_id = null;
				} else {
					const cat = await getCategoryById(supabase, patch.category_id);
					if (!cat || cat.restaurant_id !== restaurantId) {
						failed.push({ id, error: "Categoría inválida." });
						continue;
					}
					next.category_id = cat.id;
				}
			}

			if (Object.keys(next).length === 0) {
				updated += 1;
				continue;
			}

			await updateProduct(supabase, id, next);
			updated += 1;
		} catch (err) {
			failed.push({
				id,
				error: err instanceof Error ? err.message : "No se pudo guardar.",
			});
		}
	}

	return {
		ok: failed.length === 0,
		updated,
		failed,
	};
}
