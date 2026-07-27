/**
 * Client membership helpers — mirror server opts for DOM `data-menu-ids`.
 * Must not import lib/server/*.
 */

export type MenuBelongOpts = {
	treatEmptyAsAll?: boolean;
	soleMenuId?: string;
};

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

export function productBelongsToMenuDom(
	menuIdsRaw: string,
	menuId: string,
	opts?: MenuBelongOpts,
): boolean {
	return productBelongsToMenuIds(menuIdsRaw.split(/\s+/).filter(Boolean), menuId, opts);
}
