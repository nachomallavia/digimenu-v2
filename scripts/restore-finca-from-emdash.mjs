#!/usr/bin/env node
/**
 * One-off: restore EmDash Finca backup → DigiMenu v2 (Postgres + Storage).
 *
 * Usage (from digimenu-v2 root):
 *   node scripts/restore-finca-from-emdash.mjs --media-only
 *   node scripts/restore-finca-from-emdash.mjs --force [--owner-user-id <uuid>]
 *   node scripts/restore-finca-from-emdash.mjs --force --skip-media
 *   node scripts/restore-finca-from-emdash.mjs --dry-run
 *
 * Env (digimenu-v2/.env):
 *   PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 *   WORKER_MEDIA_BASE   default https://digimenu.nachomallavia.workers.dev
 *   DIGIMENU_V1_ROOT    default ../digimenu (sibling)
 *   CLOUDFLARE_API_TOKEN  enables `wrangler r2 object get --remote` fallback
 *
 * Media resolution (first hit wins):
 *   1. productos-4x5 via finca-image-map.json (real Finca photos, by product slug)
 *   2. tmp/demo-images/{EmDash filename} (Unsplash cache used in v1)
 *   3. HTTP GET {WORKER}/_emdash/api/media/file/{storageKey}
 *   4. wrangler r2 object get digimenu-media/{storageKey} --remote
 */

import { createClient } from "@supabase/supabase-js";
import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { existsSync } from "node:fs";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const MEDIA_BUCKET = "media";
const SLUG = "finca";

function parseArgs(argv) {
	const out = {
		force: false,
		mediaOnly: false,
		skipMedia: false,
		dryRun: false,
		ownerUserId: "",
		backupDir: "",
		v1Root: "",
	};
	for (let i = 2; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--force") out.force = true;
		else if (a === "--media-only") out.mediaOnly = true;
		else if (a === "--skip-media") out.skipMedia = true;
		else if (a === "--dry-run") out.dryRun = true;
		else if (a === "--owner-user-id") out.ownerUserId = argv[++i] ?? "";
		else if (a === "--backup-dir") out.backupDir = argv[++i] ?? "";
		else if (a === "--v1-root") out.v1Root = argv[++i] ?? "";
		else if (a === "--help" || a === "-h") out.help = true;
		else throw new Error(`Unknown arg: ${a}`);
	}
	return out;
}

async function loadDotEnv(filePath) {
	try {
		const text = await readFile(filePath, "utf8");
		for (const line of text.split("\n")) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;
			const i = trimmed.indexOf("=");
			if (i < 1) continue;
			const key = trimmed.slice(0, i);
			let val = trimmed.slice(i + 1);
			if (
				(val.startsWith('"') && val.endsWith('"')) ||
				(val.startsWith("'") && val.endsWith("'"))
			) {
				val = val.slice(1, -1);
			}
			if (!process.env[key]) process.env[key] = val;
		}
	} catch {
		/* optional */
	}
}

/** Minimal RFC4180 CSV parser (handles quotes / commas / newlines in fields). */
function parseCsv(text) {
	const rows = [];
	let row = [];
	let field = "";
	let i = 0;
	let inQuotes = false;
	while (i < text.length) {
		const c = text[i];
		if (inQuotes) {
			if (c === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i += 2;
					continue;
				}
				inQuotes = false;
				i++;
				continue;
			}
			field += c;
			i++;
			continue;
		}
		if (c === '"') {
			inQuotes = true;
			i++;
			continue;
		}
		if (c === ",") {
			row.push(field);
			field = "";
			i++;
			continue;
		}
		if (c === "\n" || c === "\r") {
			if (c === "\r" && text[i + 1] === "\n") i++;
			row.push(field);
			field = "";
			if (row.length > 1 || row[0] !== "") rows.push(row);
			row = [];
			i++;
			continue;
		}
		field += c;
		i++;
	}
	if (field.length || row.length) {
		row.push(field);
		rows.push(row);
	}
	if (!rows.length) return [];
	const headers = rows[0].map((h) => h.trim());
	return rows.slice(1).map((cols) => {
		const obj = {};
		for (let j = 0; j < headers.length; j++) {
			obj[headers[j]] = cols[j] ?? "";
		}
		return obj;
	});
}

function parseJsonField(raw) {
	if (raw == null || raw === "") return null;
	if (typeof raw === "object") return raw;
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

function mimeFromFilename(name) {
	const lower = name.toLowerCase();
	if (lower.endsWith(".png")) return "image/png";
	if (lower.endsWith(".webp")) return "image/webp";
	if (lower.endsWith(".gif")) return "image/gif";
	if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
	return "application/octet-stream";
}

function extForMime(mime) {
	switch (mime) {
		case "image/jpeg":
			return "jpg";
		case "image/png":
			return "png";
		case "image/webp":
			return "webp";
		case "image/gif":
			return "gif";
		default:
			return "bin";
	}
}

function publicMediaUrl(supabaseUrl, path) {
	return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}

function uuidForUlid(ulid, map) {
	if (!ulid) return null;
	if (!map.has(ulid)) map.set(ulid, randomUUID());
	return map.get(ulid);
}

function parsePipeIds(raw) {
	if (!raw || !String(raw).trim()) return [];
	return String(raw)
		.split("|")
		.map((s) => s.trim())
		.filter(Boolean);
}

async function readBackupCsv(backupDir, name) {
	const text = await readFile(join(backupDir, name), "utf8");
	return parseCsv(text);
}

async function readD1Results(backupDir, name) {
	const data = JSON.parse(await readFile(join(backupDir, name), "utf8"));
	return data[0]?.results ?? [];
}

/** mediaId → { storageKey, filename, mimeType } */
function buildMediaIndex(restaurantes, categorias, productos) {
	const index = new Map();
	const ingest = (raw) => {
		const o = parseJsonField(raw);
		if (!o?.id) return;
		const storageKey =
			o.meta?.storageKey ?? o.storageKey ?? null;
		index.set(o.id, {
			id: o.id,
			storageKey,
			filename: o.filename ?? null,
			mimeType: o.mimeType ?? mimeFromFilename(o.filename ?? storageKey ?? ""),
		});
	};
	for (const r of restaurantes) {
		ingest(r.logo_light);
		ingest(r.logo_dark);
	}
	for (const c of categorias) ingest(c.cover);
	for (const p of productos) ingest(p.imagen);
	return index;
}

async function loadFincaImageMapAsync(v1Root) {
	const path = join(v1Root, "scripts", "finca-image-map.json");
	if (!existsSync(path)) return new Map();
	const raw = JSON.parse(await readFile(path, "utf8"));
	const map = new Map();
	for (const [file, slug] of Object.entries(raw.files ?? {})) {
		map.set(slug, file);
	}
	return map;
}

async function fetchWorkerMedia(workerBase, storageKey, token) {
	if (!storageKey) return null;
	const url = `${workerBase.replace(/\/$/, "")}/_emdash/api/media/file/${storageKey}`;
	const headers = {};
	if (token) headers.Authorization = `Bearer ${token}`;
	try {
		const res = await fetch(url, { headers });
		if (!res.ok) return null;
		const buf = Buffer.from(await res.arrayBuffer());
		if (buf.length < 32) return null;
		const ctype = res.headers.get("content-type") || mimeFromFilename(storageKey);
		return { buffer: buf, mimeType: ctype.split(";")[0].trim() };
	} catch {
		return null;
	}
}

async function fetchR2Media(v1Root, storageKey, tmpDir) {
	if (!storageKey || !process.env.CLOUDFLARE_API_TOKEN) return null;
	const outFile = join(tmpDir, basename(storageKey));
	try {
		await execFileAsync(
			"npx",
			["wrangler", "r2", "object", "get", `digimenu-media/${storageKey}`, "--remote", "--file", outFile],
			{ cwd: v1Root, env: process.env, maxBuffer: 20 * 1024 * 1024 },
		);
		const buffer = await readFile(outFile);
		return { buffer, mimeType: mimeFromFilename(storageKey) };
	} catch (err) {
		console.warn(`[r2] miss ${storageKey}:`, err?.message ?? err);
		return null;
	}
}

async function resolveMediaBytes({
	meta,
	productSlug,
	fincaMap,
	v1Root,
	workerBase,
	emdashToken,
	tmpDir,
}) {
	const assets4 = join(v1Root, "src", "assets", "productos-4x5");
	const demoDir = join(v1Root, "tmp", "demo-images");

	// 1. Real Finca photo by slug
	if (productSlug && fincaMap.has(productSlug)) {
		const file = fincaMap.get(productSlug);
		const full = join(assets4, file);
		if (existsSync(full)) {
			const buffer = await readFile(full);
			return {
				buffer,
				mimeType: mimeFromFilename(file),
				source: `assets4:${file}`,
			};
		}
	}

	// 2. demo-images / assets by EmDash filename
	if (meta?.filename) {
		for (const dir of [demoDir, assets4]) {
			const full = join(dir, meta.filename);
			if (existsSync(full)) {
				const buffer = await readFile(full);
				return {
					buffer,
					mimeType: meta.mimeType || mimeFromFilename(meta.filename),
					source: `${basename(dir)}:${meta.filename}`,
				};
			}
		}
	}

	// 3. Worker HTTP
	const fromWorker = await fetchWorkerMedia(workerBase, meta?.storageKey, emdashToken);
	if (fromWorker) {
		return { ...fromWorker, source: `worker:${meta.storageKey}` };
	}

	// 4. R2 via wrangler
	const fromR2 = await fetchR2Media(v1Root, meta?.storageKey, tmpDir);
	if (fromR2) {
		return { ...fromR2, source: `r2:${meta.storageKey}` };
	}

	return null;
}

async function uploadAndUrl(supabase, supabaseUrl, restaurantId, kind, stem, buffer, mimeType, dryRun) {
	const ext = extForMime(mimeType);
	const safeStem = (stem || createHash("sha1").update(buffer).digest("hex").slice(0, 12)).replace(
		/[^a-zA-Z0-9_-]/g,
		"",
	);
	const path = `${restaurantId}/${kind}/${safeStem}.${ext}`;
	const publicUrl = publicMediaUrl(supabaseUrl, path);
	if (dryRun) return publicUrl;

	const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, buffer, {
		contentType: mimeType,
		upsert: true,
	});
	if (error) throw new Error(`storage upload ${path}: ${error.message}`);
	return publicUrl;
}

async function assertOk(label, error) {
	if (error) throw new Error(`${label}: ${error.message}`);
}

async function wipeRestaurant(supabase, restaurantId, dryRun) {
	console.log(`[wipe] restaurant ${restaurantId}`);
	if (dryRun) return;
	const { error } = await supabase.from("restaurants").delete().eq("id", restaurantId);
	await assertOk("delete restaurant", error);
}

async function importCatalog({ supabase, backupDir, idMap, dryRun }) {
	const restaurantes = await readBackupCsv(backupDir, "restaurantes.csv");
	const categorias = await readBackupCsv(backupDir, "categorias.csv");
	const tags = await readBackupCsv(backupDir, "tags.csv");
	const productos = await readBackupCsv(backupDir, "productos.csv");
	const menus = await readBackupCsv(backupDir, "menus.csv");
	const menuProductos = await readBackupCsv(backupDir, "menu_productos.csv");

	const rest = restaurantes[0];
	if (!rest) throw new Error("No restaurant row in restaurantes.csv");
	const restaurantId = uuidForUlid(rest.id, idMap);

	const brand = parseJsonField(rest.brand_json) ?? {};
	const theme = parseJsonField(rest.theme_json) ?? {};

	console.log(`[catalog] restaurant ${rest.slug} → ${restaurantId}`);
	if (!dryRun) {
		const { error } = await supabase.from("restaurants").insert({
			id: restaurantId,
			slug: rest.slug,
			name: rest.nombre,
			description: rest.descripcion || null,
			active: true,
			brand,
			theme,
			logo_light_url: null,
			logo_dark_url: null,
		});
		await assertOk("insert restaurant", error);
	}

	for (const c of categorias) {
		const id = uuidForUlid(c.id, idMap);
		if (!dryRun) {
			const { error } = await supabase.from("categories").insert({
				id,
				restaurant_id: restaurantId,
				slug: c.slug,
				name: c.nombre,
				icon: c.icon || null,
				sort_order: Number(c.orden || 0),
				cover_url: null,
				active: true,
			});
			await assertOk(`category ${c.slug}`, error);
		}
	}
	console.log(`[catalog] categories ${categorias.length}`);

	for (const t of tags) {
		const id = uuidForUlid(t.id, idMap);
		if (!dryRun) {
			const { error } = await supabase.from("tags").insert({
				id,
				restaurant_id: restaurantId,
				slug: t.slug,
				name: t.nombre,
				icon: t.icon || null,
				active: true,
			});
			await assertOk(`tag ${t.slug}`, error);
		}
	}
	console.log(`[catalog] tags ${tags.length}`);

	for (const p of productos) {
		const id = uuidForUlid(p.id, idMap);
		const categoryId = p.categoria_id ? uuidForUlid(p.categoria_id, idMap) : null;
		const price = Number(p.precio);
		if (!dryRun) {
			const { error } = await supabase.from("products").insert({
				id,
				restaurant_id: restaurantId,
				slug: p.slug,
				name: p.nombre,
				description: p.descripcion || null,
				price: Number.isFinite(price) ? price : 0,
				category_id: categoryId,
				image_url: null,
				active: true,
				available: true,
			});
			await assertOk(`product ${p.slug}`, error);
		}
	}
	console.log(`[catalog] products ${productos.length}`);

	for (const m of menus) {
		const id = uuidForUlid(m.id, idMap);
		if (!dryRun) {
			const { error } = await supabase.from("menus").insert({
				id,
				restaurant_id: restaurantId,
				slug: m.slug,
				name: m.nombre,
				description: m.descripcion || null,
				sort_order: Number(m.orden || 0),
				template: m.plantilla || "classic",
				icon: m.icon || null,
				active: true,
			});
			await assertOk(`menu ${m.slug}`, error);
		}
	}
	console.log(`[catalog] menus ${menus.length}`);

	let mpCount = 0;
	for (const mp of menuProductos) {
		const menuId = idMap.get(mp.menu_id);
		const productId = idMap.get(mp.producto_id);
		if (!menuId || !productId) continue;
		if (!dryRun) {
			const { error } = await supabase.from("menu_products").insert({
				menu_id: menuId,
				product_id: productId,
				restaurant_id: restaurantId,
				sort_order: Number(mp.orden || 0),
			});
			if (error && !/duplicate|unique/i.test(error.message)) {
				await assertOk(`menu_product`, error);
			}
		}
		mpCount++;
	}
	console.log(`[catalog] menu_products ${mpCount}`);

	let ptCount = 0;
	for (const p of productos) {
		const productId = idMap.get(p.id);
		for (const tagUlid of parsePipeIds(p.tags_ids)) {
			const tagId = idMap.get(tagUlid);
			if (!productId || !tagId) continue;
			if (!dryRun) {
				const { error } = await supabase.from("product_tags").insert({
					product_id: productId,
					tag_id: tagId,
					restaurant_id: restaurantId,
				});
				if (error && !/duplicate|unique/i.test(error.message)) {
					await assertOk(`product_tag`, error);
				}
			}
			ptCount++;
		}
	}
	console.log(`[catalog] product_tags ${ptCount}`);

	return {
		restaurantId,
		csv: { restaurantes, categorias, tags, productos, menus },
	};
}

async function attachMedia({
	supabase,
	supabaseUrl,
	restaurantId,
	backupDir,
	v1Root,
	workerBase,
	emdashToken,
	tmpDir,
	dryRun,
	/** When media-only: map backup ULID → existing UUID by slug */
	existingBySlug,
}) {
	const fincaMap = await loadFincaImageMapAsync(v1Root);
	const d1Rest = await readD1Results(backupDir, "ec_restaurantes.d1.json");
	const d1Cats = await readD1Results(backupDir, "ec_categorias.d1.json");
	const d1Prods = await readD1Results(backupDir, "ec_productos.d1.json");
	const mediaIndex = buildMediaIndex(d1Rest, d1Cats, d1Prods);

	const csvRest = (await readBackupCsv(backupDir, "restaurantes.csv"))[0];
	const csvCats = await readBackupCsv(backupDir, "categorias.csv");
	const csvProds = await readBackupCsv(backupDir, "productos.csv");

	// Backup slug → current DB slug (manual renames after restore)
	const SLUG_ALIASES = {
		"coca-cola": "coca-cola-coca-zero",
		"toston-crudo-rucula-y-pera": "toston-de-jamon-crudo-rucula-y-pera",
		"cazuela-huevo-palta-y-cherry": "cazuela-de-huevo-palta-y-cherrys",
	};

	function resolveProductId(backupSlug) {
		if (!existingBySlug?.products) return null;
		const aliased = SLUG_ALIASES[backupSlug] ?? backupSlug;
		return existingBySlug.products.get(aliased) ?? existingBySlug.products.get(backupSlug) ?? null;
	}

	const stats = { ok: 0, miss: 0, errors: 0 };

	async function one(kind, mediaId, stem, productSlug, update) {
		if (!mediaId) return;
		const meta = mediaIndex.get(mediaId);
		if (!meta) {
			console.warn(`[media] no meta for ${mediaId}`);
			stats.miss++;
			return;
		}
		try {
			const resolved = await resolveMediaBytes({
				meta,
				productSlug,
				fincaMap,
				v1Root,
				workerBase,
				emdashToken,
				tmpDir,
			});
			if (!resolved) {
				console.warn(`[media] MISS ${kind}/${stem} filename=${meta.filename} key=${meta.storageKey}`);
				stats.miss++;
				return;
			}
			const url = await uploadAndUrl(
				supabase,
				supabaseUrl,
				restaurantId,
				kind,
				stem,
				resolved.buffer,
				resolved.mimeType,
				dryRun,
			);
			if (!dryRun) await update(url);
			console.log(`[media] OK ${kind}/${stem} ← ${resolved.source}`);
			stats.ok++;
		} catch (err) {
			console.error(`[media] ERR ${kind}/${stem}:`, err?.message ?? err);
			stats.errors++;
		}
	}

	// Logos
	await one("logos", csvRest.logo_light_id, "light", null, async (url) => {
		const { error } = await supabase
			.from("restaurants")
			.update({ logo_light_url: url })
			.eq("id", restaurantId);
		await assertOk("logo light", error);
	});
	await one("logos", csvRest.logo_dark_id, "dark", null, async (url) => {
		const { error } = await supabase
			.from("restaurants")
			.update({ logo_dark_url: url })
			.eq("id", restaurantId);
		await assertOk("logo dark", error);
	});

	// Category covers
	for (const c of csvCats) {
		const catId = existingBySlug?.categories?.get(c.slug);
		if (!catId && existingBySlug) {
			console.warn(`[media] skip category (no slug match): ${c.slug}`);
			continue;
		}
		await one("categories", c.cover_id, c.slug, null, async (url) => {
			const q = supabase.from("categories").update({ cover_url: url });
			const { error } = existingBySlug
				? await q.eq("id", catId)
				: await q.eq("restaurant_id", restaurantId).eq("slug", c.slug);
			await assertOk(`cover ${c.slug}`, error);
		});
	}

	// Products
	for (const p of csvProds) {
		const prodId = existingBySlug ? resolveProductId(p.slug) : null;
		if (!prodId && existingBySlug) {
			console.warn(`[media] skip product (no slug match): ${p.slug}`);
			continue;
		}
		const stemSlug =
			(existingBySlug &&
				[...existingBySlug.products.entries()].find(([, id]) => id === prodId)?.[0]) ||
			p.slug;
		await one("products", p.imagen_id, stemSlug, p.slug, async (url) => {
			const q = supabase.from("products").update({ image_url: url });
			const { error } = existingBySlug
				? await q.eq("id", prodId)
				: await q.eq("restaurant_id", restaurantId).eq("slug", p.slug);
			await assertOk(`image ${p.slug}`, error);
		});
	}

	return stats;
}

async function linkOwner(supabase, restaurantId, userId, dryRun) {
	if (!userId) {
		console.log("[owner] skip (pass --owner-user-id to link)");
		return;
	}
	console.log(`[owner] link user ${userId}`);
	if (dryRun) return;
	const { error } = await supabase.from("owner_restaurants").upsert(
		{ user_id: userId, restaurant_id: restaurantId },
		{ onConflict: "user_id,restaurant_id" },
	);
	await assertOk("owner_restaurants", error);
}

async function loadExistingSlugMaps(supabase, restaurantId) {
	const [{ data: products, error: e1 }, { data: categories, error: e2 }] = await Promise.all([
		supabase.from("products").select("id, slug").eq("restaurant_id", restaurantId),
		supabase.from("categories").select("id, slug").eq("restaurant_id", restaurantId),
	]);
	await assertOk("list products", e1);
	await assertOk("list categories", e2);
	return {
		products: new Map((products ?? []).map((p) => [p.slug, p.id])),
		categories: new Map((categories ?? []).map((c) => [c.slug, c.id])),
	};
}

async function main() {
	const args = parseArgs(process.argv);
	if (args.help) {
		console.log(`See header comment in ${basename(fileURLToPath(import.meta.url))}`);
		return;
	}
	if (args.force && args.mediaOnly) {
		throw new Error("Use either --force or --media-only, not both");
	}

	await loadDotEnv(join(ROOT, ".env"));
	// Prefer v1 EmDash token for Worker media if present
	const v1RootDefault = resolve(ROOT, args.v1Root || process.env.DIGIMENU_V1_ROOT || "../digimenu");
	await loadDotEnv(join(v1RootDefault, ".env"));

	const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
	const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!supabaseUrl || !serviceKey) {
		throw new Error("Need PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
	}

	const v1Root = resolve(ROOT, args.v1Root || process.env.DIGIMENU_V1_ROOT || "../digimenu");
	const backupDir = resolve(
		args.backupDir || join(v1Root, "backups", "emdash-2026-07-26"),
	);
	const workerBase =
		process.env.WORKER_MEDIA_BASE || "https://digimenu.nachomallavia.workers.dev";
	const emdashToken = process.env.EMDASH_API_TOKEN || "";
	const tmpDir = join(ROOT, ".tmp-media");
	await mkdir(tmpDir, { recursive: true });

	if (!existsSync(join(backupDir, "restaurantes.csv"))) {
		throw new Error(`Backup not found: ${backupDir}`);
	}

	const supabase = createClient(supabaseUrl, serviceKey, {
		auth: { persistSession: false, autoRefreshToken: false },
	});

	const { data: existing, error: exErr } = await supabase
		.from("restaurants")
		.select("id, slug")
		.eq("slug", SLUG)
		.maybeSingle();
	await assertOk("lookup finca", exErr);

	let restaurantId = existing?.id ?? null;
	let preservedOwnerId = args.ownerUserId || "";

	if (existing && !args.force && !args.mediaOnly) {
		throw new Error(
			`Restaurant slug "${SLUG}" already exists (${existing.id}). Use --force to wipe+reimport or --media-only to attach images.`,
		);
	}

	if (args.mediaOnly) {
		if (!existing) throw new Error(`--media-only requires existing slug "${SLUG}"`);
		restaurantId = existing.id;
		console.log(`[mode] media-only on ${restaurantId}`);
		if (args.skipMedia) throw new Error("--media-only incompatible with --skip-media");
		const existingBySlug = await loadExistingSlugMaps(supabase, restaurantId);
		const stats = await attachMedia({
			supabase,
			supabaseUrl,
			restaurantId,
			backupDir,
			v1Root,
			workerBase,
			emdashToken,
			tmpDir,
			dryRun: args.dryRun,
			existingBySlug,
		});
		console.log("[done] media stats", stats);
		console.log(`[verify] /m/${SLUG} on your v2 deploy`);
		return;
	}

	// Full import path
	if (existing && args.force) {
		if (!preservedOwnerId) {
			const { data: owners } = await supabase
				.from("owner_restaurants")
				.select("user_id")
				.eq("restaurant_id", existing.id)
				.limit(1);
			preservedOwnerId = owners?.[0]?.user_id ?? "";
		}
		await wipeRestaurant(supabase, existing.id, args.dryRun);
		restaurantId = null;
	}

	const idMap = new Map();
	const { restaurantId: newId } = await importCatalog({
		supabase,
		backupDir,
		idMap,
		dryRun: args.dryRun,
	});
	restaurantId = newId;

	if (!args.skipMedia) {
		const stats = await attachMedia({
			supabase,
			supabaseUrl,
			restaurantId,
			backupDir,
			v1Root,
			workerBase,
			emdashToken,
			tmpDir,
			dryRun: args.dryRun,
			existingBySlug: null,
		});
		console.log("[done] media stats", stats);
	} else {
		console.log("[media] skipped");
	}

	await linkOwner(supabase, restaurantId, preservedOwnerId, args.dryRun);
	console.log(`[verify] restaurant_id=${restaurantId} → /m/${SLUG}`);
}

main().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
