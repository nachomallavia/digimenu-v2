export type MenuBelongOpts = {
	/** When membership list is empty and there are no DB menus (synthetic Carta). */
	treatEmptyAsAll?: boolean;
	/** When membership list is empty and the restaurant has exactly one menu. */
	soleMenuId?: string;
};

/**
 * Build productId → menuIds from `menu_products` rows.
 * Sole-menu / synthetic empty fallbacks match historical public behaviour.
 */
export function buildProductMenuIdsMap(
	rows: Array<{ menu_id: string; product_id: string }>,
	opts?: MenuBelongOpts,
): Map<string, string[]> {
	const map = new Map<string, string[]>();
	let anyExplicit = false;

	for (const { menu_id, product_id } of rows) {
		anyExplicit = true;
		const list = map.get(product_id) ?? [];
		if (!list.includes(menu_id)) list.push(menu_id);
		map.set(product_id, list);
	}

	if (!anyExplicit && opts?.treatEmptyAsAll) {
		return map; // caller treats empty menuIds as "all"
	}

	return map;
}

/** True when product belongs to menu given inverted membership + fallbacks. */
export function productBelongsToMenuIds(
	productMenuIds: string[],
	menuId: string,
	opts?: MenuBelongOpts,
): boolean {
	if (productMenuIds.length === 0) {
		if (opts?.treatEmptyAsAll) return true;
		if (opts?.soleMenuId) return menuId === opts.soleMenuId;
		return false;
	}
	return productMenuIds.includes(menuId);
}

/** Membership from space-separated `data-menu-ids` on the public menu DOM. */
export function productBelongsToMenuDom(
	menuIdsRaw: string,
	menuId: string,
	opts?: MenuBelongOpts,
): boolean {
	return productBelongsToMenuIds(menuIdsRaw.split(/\s+/).filter(Boolean), menuId, opts);
}
