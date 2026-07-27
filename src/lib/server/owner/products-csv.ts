/**
 * Owner product CSV import/export (DIG-21).
 * ES headers; upsert by HMAC-signed id; category/tag near-match resolutions.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { slugFromName, type Category, type Product, type Tag } from "@/lib/domain";
import {
	createCategory,
	createProduct,
	createTag,
	DbError,
	getCategoryById,
	getCategoryBySlug,
	getProductById,
	getProductBySlug,
	getTagById,
	getTagBySlug,
	listCategoriesByRestaurant,
	listProductsByRestaurant,
	listProductTagsByRestaurant,
	listTagsByRestaurant,
	setProductTags,
	updateProduct,
} from "@/lib/server/db";
import { uploadMedia } from "./media";

export const PRODUCTS_CSV_HEADERS = [
	"nombre",
	"descripcion",
	"precio",
	"categoria",
	"etiquetas",
	"imagen",
	"id",
	"id_sig",
] as const;

const MAX_CSV_ROWS = 200;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type ProductCsvRow = {
	row: number;
	id: string;
	idSig: string;
	nombre: string;
	descripcion: string;
	precio: string;
	categoria: string;
	etiquetas: string;
	imagen: string;
};

export type NameSimilar = {
	id: string;
	name: string;
	distance: number;
};

export type NewNamePreview = {
	key: string;
	displayName: string;
	similar: NameSimilar[];
};

export type NameResolution = { action: "create" } | { action: "use"; id: string };

export type NameResolutions = Record<string, NameResolution>;

export type CsvImportResult = {
	ok: boolean;
	created: number;
	updated: number;
	categoriesCreated: number;
	tagsCreated: number;
	failed: { row: number; error: string }[];
};

export type CsvPreviewResult =
	| {
			ok: true;
			rowCount: number;
			updateCount: number;
			newProductos: string[];
			newCategorias: NewNamePreview[];
			newEtiquetas: NewNamePreview[];
	  }
	| { ok: false; error: string };

function getCsvSecret(): string {
	const secret = import.meta.env.DIGIMENU_ID_HASH_SECRET;
	if (!secret?.trim()) {
		throw new DbError(
			"Falta DIGIMENU_ID_HASH_SECRET para firmar IDs del CSV.",
		);
	}
	return secret.trim();
}

async function hmacHexTrunc(secret: string, data: string, len = 16): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
	const bytes = new Uint8Array(sig);
	let hex = "";
	for (const b of bytes) hex += b.toString(16).padStart(2, "0");
	return hex.slice(0, len);
}

export async function signProductCsvId(
	restaurantId: string,
	productId: string,
): Promise<string> {
	return hmacHexTrunc(getCsvSecret(), `${restaurantId}:${productId}`);
}

export async function verifyProductCsvId(
	restaurantId: string,
	productId: string,
	signature: string,
): Promise<boolean> {
	if (!productId || !signature) return false;
	const expected = await signProductCsvId(restaurantId, productId);
	if (expected.length !== signature.length) return false;
	let mismatch = 0;
	for (let i = 0; i < expected.length; i++) {
		mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
	}
	return mismatch === 0;
}

/** Lowercase, strip accents, remove spaces. */
export function normalizeNameKey(name: string): string {
	return name
		.trim()
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/\s+/g, "");
}

export function levenshtein(a: string, b: string): number {
	if (a === b) return 0;
	if (!a.length) return b.length;
	if (!b.length) return a.length;
	const prev = new Array<number>(b.length + 1);
	const curr = new Array<number>(b.length + 1);
	for (let j = 0; j <= b.length; j++) prev[j] = j;
	for (let i = 1; i <= a.length; i++) {
		curr[0] = i;
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
		}
		for (let j = 0; j <= b.length; j++) prev[j] = curr[j]!;
	}
	return prev[b.length]!;
}

function similarDistanceThreshold(keyLen: number): number {
	if (keyLen <= 2) return 0;
	if (keyLen <= 4) return 1;
	return 2;
}

export function findSimilarNames(
	key: string,
	existing: { id: string; name: string; key: string }[],
	limit = 3,
): NameSimilar[] {
	const maxDist = similarDistanceThreshold(key.length);
	if (maxDist === 0) return [];
	const scored = existing
		.map((c) => ({
			id: c.id,
			name: c.name,
			distance: levenshtein(key, c.key),
		}))
		.filter((c) => c.distance > 0 && c.distance <= maxDist)
		.sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name));
	return scored.slice(0, limit);
}

export function escapeCsvField(value: string): string {
	if (/[",\n\r]/.test(value)) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

export function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let i = 0;
	let inQuotes = false;
	const input = text.replace(/^\uFEFF/, "");

	while (i < input.length) {
		const ch = input[i]!;
		if (inQuotes) {
			if (ch === '"') {
				if (input[i + 1] === '"') {
					field += '"';
					i += 2;
					continue;
				}
				inQuotes = false;
				i += 1;
				continue;
			}
			field += ch;
			i += 1;
			continue;
		}
		if (ch === '"') {
			inQuotes = true;
			i += 1;
			continue;
		}
		if (ch === ",") {
			row.push(field);
			field = "";
			i += 1;
			continue;
		}
		if (ch === "\n") {
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
			i += 1;
			continue;
		}
		if (ch === "\r") {
			i += 1;
			continue;
		}
		field += ch;
		i += 1;
	}
	row.push(field);
	if (row.length > 1 || (row.length === 1 && row[0] !== "")) {
		rows.push(row);
	}
	return rows;
}

export function parseProductsCsv(text: string): {
	rows: ProductCsvRow[];
	error?: string;
} {
	const table = parseCsv(text);
	if (table.length === 0) {
		return { rows: [], error: "CSV vacío." };
	}
	const header = table[0]!.map((h) => h.trim().toLowerCase());
	const idx = (name: string) => header.indexOf(name);
	for (const required of PRODUCTS_CSV_HEADERS) {
		if (idx(required) < 0) {
			return { rows: [], error: `Falta la columna «${required}».` };
		}
	}

	const rows: ProductCsvRow[] = [];
	for (let r = 1; r < table.length; r++) {
		const cells = table[r]!;
		const get = (name: (typeof PRODUCTS_CSV_HEADERS)[number]) =>
			(cells[idx(name)] ?? "").trim();
		const nombre = get("nombre");
		const precio = get("precio");
		const id = get("id");
		const idSig = get("id_sig");
		const descripcion = get("descripcion");
		const categoria = get("categoria");
		const etiquetas = get("etiquetas");
		const imagen = get("imagen");
		if (
			!nombre &&
			!precio &&
			!id &&
			!categoria &&
			!etiquetas &&
			!descripcion &&
			!imagen
		) {
			continue;
		}
		rows.push({
			row: r + 1,
			id,
			idSig,
			nombre,
			descripcion,
			precio,
			categoria,
			etiquetas,
			imagen,
		});
	}
	return { rows };
}

/** Split CSV etiquetas cell: `Vegano; Picante` or `Vegano|Picante`. */
export function splitEtiquetasCell(raw: string): string[] {
	return raw
		.split(/[;|]/)
		.map((s) => s.trim())
		.filter(Boolean);
}

function collectNamePlan(
	rawNames: string[],
	existing: { id: string; name: string }[],
): {
	exactByKey: Map<string, string>;
	newNames: NewNamePreview[];
} {
	const indexed = existing.map((e) => ({
		id: e.id,
		name: e.name,
		key: normalizeNameKey(e.name),
	}));
	const exactByKey = new Map(indexed.map((e) => [e.key, e.id]));
	const newByKey = new Map<string, string>();

	for (const raw of rawNames) {
		const trimmed = raw.trim();
		if (!trimmed) continue;
		const key = normalizeNameKey(trimmed);
		if (!key) continue;
		if (exactByKey.has(key)) continue;
		if (!newByKey.has(key)) newByKey.set(key, trimmed);
	}

	const newNames: NewNamePreview[] = [...newByKey.entries()].map(
		([key, displayName]) => ({
			key,
			displayName,
			similar: findSimilarNames(key, indexed),
		}),
	);

	return { exactByKey, newNames };
}

function collectCsvCategoriaPlan(
	rows: ProductCsvRow[],
	categories: Category[],
) {
	return collectNamePlan(
		rows.map((r) => r.categoria),
		categories.map((c) => ({ id: c.id, name: c.name })),
	);
}

function collectCsvEtiquetasPlan(rows: ProductCsvRow[], tags: Tag[]) {
	const names: string[] = [];
	for (const row of rows) {
		names.push(...splitEtiquetasCell(row.etiquetas));
	}
	return collectNamePlan(
		names,
		tags.map((t) => ({ id: t.id, name: t.name })),
	);
}

function isPrivateHostname(hostname: string): boolean {
	const host = hostname.toLowerCase();
	if (
		host === "localhost" ||
		host === "127.0.0.1" ||
		host === "::1" ||
		host.endsWith(".local")
	) {
		return true;
	}
	if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
	if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
	if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host)) return true;
	if (/^169\.254\.\d+\.\d+$/.test(host)) return true;
	return false;
}

export function assertSafeImageFetchUrl(raw: string, allowedOrigin: string): URL {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		throw new Error("URL de imagen inválida.");
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new Error("La imagen debe ser http(s).");
	}
	let allowed: URL | null = null;
	try {
		allowed = new URL(allowedOrigin);
	} catch {
		allowed = null;
	}
	if (allowed && url.origin === allowed.origin) return url;
	if (isPrivateHostname(url.hostname)) {
		throw new Error("URL de imagen no permitida.");
	}
	return url;
}

function normalizeUrlForCompare(raw: string): string {
	try {
		const u = new URL(raw);
		u.hash = "";
		return u.href.replace(/\/$/, "");
	} catch {
		return raw.trim().replace(/\/$/, "");
	}
}

/**
 * Returns a new public Storage URL, or `undefined` to leave image unchanged.
 * Empty csvUrl → undefined (no change / no image on create).
 */
async function resolveProductImageUrl(
	supabase: SupabaseClient,
	restaurantId: string,
	currentUrl: string | null,
	csvUrl: string,
	allowedOrigin: string,
): Promise<string | undefined> {
	const trimmed = csvUrl.trim();
	if (!trimmed) return undefined;

	if (
		currentUrl &&
		normalizeUrlForCompare(currentUrl) === normalizeUrlForCompare(trimmed)
	) {
		return undefined;
	}

	const url = assertSafeImageFetchUrl(trimmed, allowedOrigin);
	const res = await fetch(url.href, {
		redirect: "follow",
		headers: { Accept: "image/*,*/*" },
	});
	if (!res.ok) {
		throw new Error(`No se pudo descargar la imagen (${res.status}).`);
	}
	const len = Number(res.headers.get("content-length") ?? "0");
	if (len > MAX_IMAGE_BYTES) {
		throw new Error("Imagen demasiado grande (máx. 5MB).");
	}
	const buf = await res.arrayBuffer();
	if (buf.byteLength > MAX_IMAGE_BYTES) {
		throw new Error("Imagen demasiado grande (máx. 5MB).");
	}
	const contentType = (res.headers.get("content-type") ?? "application/octet-stream")
		.split(";")[0]!
		.trim();
	const mime =
		contentType === "image/jpeg" ||
		contentType === "image/png" ||
		contentType === "image/webp" ||
		contentType === "image/gif"
			? contentType
			: "image/jpeg";
	const ext =
		mime === "image/png"
			? "png"
			: mime === "image/webp"
				? "webp"
				: mime === "image/gif"
					? "gif"
					: "jpg";
	const file = new File([buf], `import.${ext}`, { type: mime });
	const uploaded = await uploadMedia(supabase, {
		restaurantId,
		kind: "products",
		file,
	});
	return uploaded.publicUrl;
}

function formatPrice(price: number): string {
	if (!Number.isFinite(price)) return "";
	const rounded = Math.round(price * 100) / 100;
	return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function parsePrice(raw: string): number | null {
	const n = Number(String(raw).trim().replace(",", "."));
	if (!Number.isFinite(n) || n < 0) return null;
	return Math.round(n * 100) / 100;
}

async function uniqueSlug(
	exists: (slug: string) => Promise<boolean>,
	name: string,
): Promise<string> {
	const base = slugFromName(name);
	let slug = base;
	let n = 2;
	while (await exists(slug)) {
		slug = `${base}-${n++}`;
	}
	return slug;
}

export async function exportProductsCsv(
	supabase: SupabaseClient,
	restaurantId: string,
): Promise<string> {
	const [products, categories, tags, junctions] = await Promise.all([
		listProductsByRestaurant(supabase, restaurantId),
		listCategoriesByRestaurant(supabase, restaurantId),
		listTagsByRestaurant(supabase, restaurantId),
		listProductTagsByRestaurant(supabase, restaurantId),
	]);

	const catById = new Map(categories.map((c) => [c.id, c.name]));
	const tagById = new Map(tags.map((t) => [t.id, t.name]));
	const tagsByProduct = new Map<string, string[]>();
	for (const j of junctions) {
		const list = tagsByProduct.get(j.product_id) ?? [];
		const name = tagById.get(j.tag_id);
		if (name && !list.includes(name)) list.push(name);
		tagsByProduct.set(j.product_id, list);
	}

	const lines = [PRODUCTS_CSV_HEADERS.join(",")];
	for (const p of products) {
		const idSig = await signProductCsvId(restaurantId, p.id);
		const catName = p.category_id ? (catById.get(p.category_id) ?? "") : "";
		const tagNames = (tagsByProduct.get(p.id) ?? []).join("; ");
		lines.push(
			[
				escapeCsvField(p.name),
				escapeCsvField(p.description ?? ""),
				escapeCsvField(formatPrice(p.price)),
				escapeCsvField(catName),
				escapeCsvField(tagNames),
				escapeCsvField(p.image_url ?? ""),
				escapeCsvField(p.id),
				escapeCsvField(idSig),
			].join(","),
		);
	}
	return `\uFEFF${lines.join("\n")}\n`;
}

export async function previewProductsCsvImport(
	supabase: SupabaseClient,
	restaurantId: string,
	csv: string,
): Promise<CsvPreviewResult> {
	const parsed = parseProductsCsv(csv);
	if (parsed.error) return { ok: false, error: parsed.error };
	if (parsed.rows.length > MAX_CSV_ROWS) {
		return { ok: false, error: `Máximo ${MAX_CSV_ROWS} filas por importación.` };
	}

	const [categories, tags] = await Promise.all([
		listCategoriesByRestaurant(supabase, restaurantId),
		listTagsByRestaurant(supabase, restaurantId),
	]);
	const { newNames: newCategorias } = collectCsvCategoriaPlan(parsed.rows, categories);
	const { newNames: newEtiquetas } = collectCsvEtiquetasPlan(parsed.rows, tags);
	const newProductos = parsed.rows
		.filter((r) => !r.id.trim())
		.map((r) => r.nombre.trim() || `(fila ${r.row})`);
	const updateCount = parsed.rows.filter((r) => r.id.trim()).length;

	return {
		ok: true,
		rowCount: parsed.rows.length,
		updateCount,
		newProductos,
		newCategorias,
		newEtiquetas,
	};
}

export function parseNameResolutions(raw: unknown): NameResolutions | null {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
	const out: NameResolutions = {};
	for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
		if (!key || !value || typeof value !== "object" || Array.isArray(value)) {
			return null;
		}
		const action = (value as { action?: unknown }).action;
		if (action === "create") {
			out[key] = { action: "create" };
			continue;
		}
		if (action === "use") {
			const id = String((value as { id?: unknown }).id ?? "");
			if (!id) return null;
			out[key] = { action: "use", id };
			continue;
		}
		return null;
	}
	return out;
}

async function applyNameResolutions(opts: {
	newNames: NewNamePreview[];
	exactByKey: Map<string, string>;
	resolutions: NameResolutions;
	create: (displayName: string) => Promise<string>;
	assertOwned: (id: string) => Promise<boolean>;
	label: string;
}): Promise<
	| { ok: true; byKey: Map<string, string>; created: number }
	| { ok: false; error: string; newNames?: NewNamePreview[] }
> {
	const { newNames, exactByKey, resolutions, create, assertOwned, label } = opts;
	for (const preview of newNames) {
		if (!(preview.key in resolutions)) {
			return {
				ok: false,
				error: `Faltan resoluciones para ${label} nuevas.`,
				newNames,
			};
		}
	}

	const byKey = new Map(exactByKey);
	let created = 0;

	for (const preview of newNames) {
		const res = resolutions[preview.key]!;
		if (res.action === "use") {
			const owned = await assertOwned(res.id);
			if (!owned) {
				return {
					ok: false,
					error: `${label} inválida para «${preview.displayName}».`,
				};
			}
			byKey.set(preview.key, res.id);
			continue;
		}
		const newId = await create(preview.displayName);
		byKey.set(preview.key, newId);
		created += 1;
	}

	return { ok: true, byKey, created };
}

function resolveRowTagIds(cell: string, byKey: Map<string, string>): string[] {
	const ids: string[] = [];
	for (const name of splitEtiquetasCell(cell)) {
		const key = normalizeNameKey(name);
		const id = key ? byKey.get(key) : undefined;
		if (!id) continue;
		if (!ids.includes(id)) ids.push(id);
	}
	return ids;
}

export async function importProductsCsv(
	supabase: SupabaseClient,
	opts: {
		restaurantId: string;
		csv: string;
		allowedOrigin: string;
		categoriaResolutions: NameResolutions;
		etiquetaResolutions: NameResolutions;
	},
): Promise<CsvImportResult> {
	const parsed = parseProductsCsv(opts.csv);
	if (parsed.error) {
		return {
			ok: false,
			created: 0,
			updated: 0,
			categoriesCreated: 0,
			tagsCreated: 0,
			failed: [{ row: 0, error: parsed.error }],
		};
	}
	if (parsed.rows.length === 0) {
		return {
			ok: true,
			created: 0,
			updated: 0,
			categoriesCreated: 0,
			tagsCreated: 0,
			failed: [],
		};
	}
	if (parsed.rows.length > MAX_CSV_ROWS) {
		return {
			ok: false,
			created: 0,
			updated: 0,
			categoriesCreated: 0,
			tagsCreated: 0,
			failed: [
				{
					row: 0,
					error: `Máximo ${MAX_CSV_ROWS} filas por importación.`,
				},
			],
		};
	}

	const [categories, tags] = await Promise.all([
		listCategoriesByRestaurant(supabase, opts.restaurantId),
		listTagsByRestaurant(supabase, opts.restaurantId),
	]);

	const catPlan = collectCsvCategoriaPlan(parsed.rows, categories);
	const tagPlan = collectCsvEtiquetasPlan(parsed.rows, tags);

	let nextCatOrden =
		categories.reduce((max, c) => Math.max(max, c.sort_order ?? 0), 0) + 1;

	const catResult = await applyNameResolutions({
		newNames: catPlan.newNames,
		exactByKey: catPlan.exactByKey,
		resolutions: opts.categoriaResolutions,
		label: "categorías",
		assertOwned: async (id) => {
			const row = await getCategoryById(supabase, id);
			return Boolean(row && row.restaurant_id === opts.restaurantId);
		},
		create: async (displayName) => {
			const slug = await uniqueSlug(
				async (s) =>
					Boolean(await getCategoryBySlug(supabase, opts.restaurantId, s)),
				displayName,
			);
			const created = await createCategory(supabase, {
				restaurant_id: opts.restaurantId,
				slug,
				name: displayName,
				sort_order: nextCatOrden++,
			});
			return created.id;
		},
	});
	if (!catResult.ok) {
		return {
			ok: false,
			created: 0,
			updated: 0,
			categoriesCreated: 0,
			tagsCreated: 0,
			failed: [{ row: 0, error: catResult.error }],
		};
	}

	const tagResult = await applyNameResolutions({
		newNames: tagPlan.newNames,
		exactByKey: tagPlan.exactByKey,
		resolutions: opts.etiquetaResolutions,
		label: "etiquetas",
		assertOwned: async (id) => {
			const row = await getTagById(supabase, id);
			return Boolean(row && row.restaurant_id === opts.restaurantId);
		},
		create: async (displayName) => {
			const slug = await uniqueSlug(
				async (s) => Boolean(await getTagBySlug(supabase, opts.restaurantId, s)),
				displayName,
			);
			const created = await createTag(supabase, {
				restaurant_id: opts.restaurantId,
				slug,
				name: displayName,
			});
			return created.id;
		},
	});
	if (!tagResult.ok) {
		return {
			ok: false,
			created: 0,
			updated: 0,
			categoriesCreated: catResult.created,
			tagsCreated: 0,
			failed: [{ row: 0, error: tagResult.error }],
		};
	}

	const failed: { row: number; error: string }[] = [];
	let created = 0;
	let updated = 0;

	for (const row of parsed.rows) {
		try {
			const nombre = row.nombre.trim();
			const precio = parsePrice(row.precio);
			if (!nombre) {
				failed.push({ row: row.row, error: "Nombre obligatorio." });
				continue;
			}
			if (precio === null) {
				failed.push({ row: row.row, error: "Precio inválido." });
				continue;
			}

			let categoryId: string | null = null;
			if (row.categoria.trim()) {
				const key = normalizeNameKey(row.categoria);
				if (!key || !catResult.byKey.has(key)) {
					failed.push({ row: row.row, error: "Categoría no resuelta." });
					continue;
				}
				categoryId = catResult.byKey.get(key) ?? null;
			}

			const tagIds = resolveRowTagIds(row.etiquetas, tagResult.byKey);

			if (row.id) {
				const sigOk = await verifyProductCsvId(
					opts.restaurantId,
					row.id,
					row.idSig,
				);
				if (!sigOk) {
					failed.push({ row: row.row, error: "Id alterado o inválido." });
					continue;
				}
				const existing = await getProductById(supabase, row.id);
				if (!existing || existing.restaurant_id !== opts.restaurantId) {
					failed.push({ row: row.row, error: "Producto no encontrado." });
					continue;
				}

				let imageUrl: string | undefined;
				try {
					imageUrl = await resolveProductImageUrl(
						supabase,
						opts.restaurantId,
						existing.image_url,
						row.imagen,
						opts.allowedOrigin,
					);
				} catch (err) {
					failed.push({
						row: row.row,
						error: err instanceof Error ? err.message : "Error de imagen",
					});
					continue;
				}

				await updateProduct(supabase, existing.id, {
					name: nombre,
					price: precio,
					description: row.descripcion.trim() || null,
					category_id: categoryId,
					...(imageUrl !== undefined ? { image_url: imageUrl } : {}),
				});
				await setProductTags(supabase, opts.restaurantId, existing.id, tagIds);
				updated += 1;
			} else {
				let imageUrl: string | undefined;
				try {
					imageUrl = await resolveProductImageUrl(
						supabase,
						opts.restaurantId,
						null,
						row.imagen,
						opts.allowedOrigin,
					);
				} catch (err) {
					failed.push({
						row: row.row,
						error: err instanceof Error ? err.message : "Error de imagen",
					});
					continue;
				}

				const slug = await uniqueSlug(
					async (s) =>
						Boolean(await getProductBySlug(supabase, opts.restaurantId, s)),
					nombre,
				);
				const product: Product = await createProduct(supabase, {
					restaurant_id: opts.restaurantId,
					slug,
					name: nombre,
					price: precio,
					description: row.descripcion.trim() || null,
					category_id: categoryId,
					...(imageUrl !== undefined ? { image_url: imageUrl } : {}),
				});
				if (tagIds.length > 0) {
					await setProductTags(supabase, opts.restaurantId, product.id, tagIds);
				}
				created += 1;
			}
		} catch (err) {
			failed.push({
				row: row.row,
				error: err instanceof Error ? err.message : "Error al guardar",
			});
		}
	}

	return {
		ok: failed.length === 0,
		created,
		updated,
		categoriesCreated: catResult.created,
		tagsCreated: tagResult.created,
		failed,
	};
}
