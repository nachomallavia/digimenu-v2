/** Cache tag for all public `/m/{slug}` (+ `/{menu}`) HTML for one restaurant. */
export function restaurantPublicMenuTag(restaurantId: string): string {
	return `restaurant:${restaurantId}`;
}

type CacheLike = {
	enabled: boolean;
	invalidate: (options: { tags: string[] }) => Promise<void>;
};

/**
 * Soft-invalidate Vercel CDN entries tagged for this restaurant (DIG-26).
 * No-op when cache is disabled (dev / no provider). Purge errors are logged, not thrown.
 */
export async function revalidateRestaurantPublicMenu(
	cache: CacheLike | undefined,
	restaurantId: string,
): Promise<void> {
	if (!cache?.enabled || !restaurantId) return;
	try {
		await cache.invalidate({ tags: [restaurantPublicMenuTag(restaurantId)] });
	} catch (err) {
		console.error("[revalidateRestaurantPublicMenu]", restaurantId, err);
	}
}
