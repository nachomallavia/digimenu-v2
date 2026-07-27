/** Slug helpers for owner creates (unique per restaurant in DB). */

export function slugify(input: string): string {
	return input
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

/** Prefer explicit slug; otherwise slugify name; fallback `item`. */
export function slugFromName(name: string, explicit?: string | null): string {
	const fromExplicit = explicit?.trim() ? slugify(explicit) : "";
	const fromName = slugify(name);
	return fromExplicit || fromName || "item";
}
