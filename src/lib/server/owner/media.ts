import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/server/auth";
import { DbError } from "@/lib/server/db";

export const MEDIA_BUCKET = "media";

export type MediaKind = "logos" | "products" | "categories";

const ALLOWED_MIME = new Set([
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/gif",
]);

const MAX_BYTES = 5 * 1024 * 1024;

function extensionForMime(mime: string): string {
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

export function publicMediaUrl(path: string): string {
	const { url } = getSupabasePublicEnv();
	return `${url.replace(/\/$/, "")}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}

/** Extract storage object path from a public media URL, if it belongs to our bucket. */
export function mediaPathFromPublicUrl(publicUrl: string | null | undefined): string | null {
	if (!publicUrl) return null;
	const marker = `/storage/v1/object/public/${MEDIA_BUCKET}/`;
	const idx = publicUrl.indexOf(marker);
	if (idx === -1) return null;
	const rest = publicUrl.slice(idx + marker.length);
	const path = rest.split("?")[0]?.split("#")[0] ?? "";
	return path || null;
}

export type UploadMediaInput = {
	restaurantId: string;
	kind: MediaKind;
	file: File;
	/** Optional filename stem (without extension). Defaults to random uuid. */
	stem?: string;
};

/**
 * Upload an image to `media/{restaurant_id}/{kind}/{stem}-{id}.{ext}`.
 * Stem is always uniquified so replaces get a new public URL (avoids CDN/browser
 * serving a stale object at the same path after upsert).
 * Returns the public URL to store on the row.
 */
export async function uploadMedia(
	supabase: SupabaseClient,
	input: UploadMediaInput,
): Promise<{ path: string; publicUrl: string }> {
	const { restaurantId, kind, file, stem } = input;

	if (!(file instanceof File) || file.size <= 0) {
		throw new DbError("Empty file");
	}
	if (file.size > MAX_BYTES) {
		throw new DbError("File exceeds 5 MiB limit");
	}
	if (!ALLOWED_MIME.has(file.type)) {
		throw new DbError("Unsupported image type (use jpeg, png, webp, or gif)");
	}

	const ext = extensionForMime(file.type);
	const baseStem = (stem?.trim() || crypto.randomUUID()).replace(/[^a-zA-Z0-9_-]/g, "");
	const uniqueStem = `${baseStem || "img"}-${crypto.randomUUID().slice(0, 8)}`;
	const path = `${restaurantId}/${kind}/${uniqueStem}.${ext}`;

	const buffer = new Uint8Array(await file.arrayBuffer());
	const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, buffer, {
		contentType: file.type,
		upsert: false,
		cacheControl: "31536000",
	});

	if (error) {
		throw new DbError(error.message || "Failed to upload media");
	}

	return { path, publicUrl: publicMediaUrl(path) };
}

/** Remove an object by storage path (no-op if path empty). */
export async function removeMedia(supabase: SupabaseClient, path: string | null | undefined): Promise<void> {
	if (!path) return;
	const { error } = await supabase.storage.from(MEDIA_BUCKET).remove([path]);
	if (error) {
		throw new DbError(error.message || "Failed to remove media");
	}
}

/** Remove by public URL when it maps to our media bucket. */
export async function removeMediaByPublicUrl(
	supabase: SupabaseClient,
	publicUrl: string | null | undefined,
): Promise<void> {
	await removeMedia(supabase, mediaPathFromPublicUrl(publicUrl));
}
