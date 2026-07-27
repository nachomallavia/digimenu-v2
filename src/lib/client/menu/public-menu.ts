/**
 * Client runtime for PublicMenu: visibility, filters, History API shell nav.
 * DOM + data-* contract (Nanostores deferred — see menu.md).
 */
import { productBelongsToMenuDom } from "./membership";

function initPublicMenu(root: HTMLElement) {
	if (root.dataset.bound === "1") return;
	root.dataset.bound = "1";

	const menuRoot = root.querySelector<HTMLElement>("[data-menu-root]");
	const filterBar = root.querySelector<HTMLElement>("[data-menu-filters]");
	const emptyEl = root.querySelector<HTMLElement>("[data-menu-empty]");
	const landingView = root.querySelector<HTMLElement>('[data-shell-view="landing"]');
	const menuView = root.querySelector<HTMLElement>('[data-shell-view="menu"]');
	const clientSwitch = root.dataset.clientMenuSwitch === "1";
	const shellMode = root.dataset.shellMode === "1";
	const treatEmptyAsAll = root.dataset.hasDbMenus !== "1";
	const soleMenuId = root.dataset.soleMenuId ?? "";
	const basePath = root.dataset.basePath ?? "";
	const restaurantName = root.dataset.restaurantName ?? "";

	let activeMenuId = root.dataset.activeMenuId ?? "";
	let currentView: "landing" | "menu" =
		root.dataset.view === "landing" ? "landing" : "menu";

	const selected = {
		categories: new Set<string>(),
		tags: new Set<string>(),
	};

	const clearBtns = filterBar
		? [...filterBar.querySelectorAll<HTMLButtonElement>("[data-filter-clear]")]
		: [];
	const chips = filterBar
		? [...filterBar.querySelectorAll<HTMLButtonElement>("[data-filter-kind]")]
		: [];
	const filterTrigger = root.querySelector<HTMLElement>("[data-filter-trigger]");
	const activeMenuTitle = root.querySelector<HTMLElement>("[data-active-menu-title]");
	const header = root.querySelector<HTMLElement>("[data-menu-header]");
	let lastScrollY = window.scrollY;
	let headerHidden = false;
	const SCROLL_THRESHOLD = 8;

	function scrollY() {
		return window.scrollY || document.documentElement.scrollTop || 0;
	}

	function setHeaderHidden(hidden: boolean) {
		if (!header || headerHidden === hidden) return;
		headerHidden = hidden;
		header.classList.toggle("is-hidden", hidden);
	}

	function resetHeaderScroll() {
		setHeaderHidden(false);
		lastScrollY = scrollY();
	}

	function onHeaderScroll() {
		if (!header || currentView === "landing") return;
		const y = scrollY();
		if (y < SCROLL_THRESHOLD) {
			setHeaderHidden(false);
			lastScrollY = y;
			return;
		}
		const delta = y - lastScrollY;
		if (delta > SCROLL_THRESHOLD) {
			setHeaderHidden(true);
			lastScrollY = y;
		} else if (delta < -SCROLL_THRESHOLD) {
			setHeaderHidden(false);
			lastScrollY = y;
		}
	}

	function syncFilterGroups() {
		filterBar?.querySelectorAll<HTMLElement>("[data-filter-group]").forEach((group) => {
			const kind = group.dataset.filterGroup;
			const hasVisible = chips.some((c) => c.dataset.filterKind === kind && !c.hidden);
			group.hidden = !hasVisible;
		});
	}

	function applyVisibility() {
		if (!menuRoot) return;
		const items = menuRoot.querySelectorAll<HTMLElement>("[data-product]");
		const sections = menuRoot.querySelectorAll<HTMLElement>("[data-section]");

		let inMenuCount = 0;
		const categoriesInMenu = new Set<string>();
		const tagsInMenu = new Set<string>();

		for (const item of items) {
			const inMenu = productBelongsToMenuDom(item.dataset.menuIds ?? "", activeMenuId, {
				treatEmptyAsAll,
				soleMenuId,
			});
			item.dataset.inActiveMenu = inMenu ? "1" : "0";

			if (inMenu) {
				inMenuCount += 1;
				const categoryId = item.dataset.categoryId ?? "";
				if (categoryId) categoriesInMenu.add(categoryId);
				for (const tagId of (item.dataset.tagIds ?? "").split(/\s+/).filter(Boolean)) {
					tagsInMenu.add(tagId);
				}
			}

			const categoryId = item.dataset.categoryId ?? "";
			const tagIds = (item.dataset.tagIds ?? "").split(/\s+/).filter(Boolean);

			const categoryOk =
				selected.categories.size === 0 ||
				(categoryId !== "" && selected.categories.has(categoryId));

			const tagOk =
				selected.tags.size === 0 || [...selected.tags].every((id) => tagIds.includes(id));

			const visible = inMenu && categoryOk && tagOk;
			item.hidden = !visible;
			item.toggleAttribute("data-filtered", !visible);
		}

		for (const section of sections) {
			const visibleItems = section.querySelectorAll<HTMLElement>(
				"[data-product]:not([hidden])",
			);
			const empty = visibleItems.length === 0;
			section.hidden = empty;
			section.toggleAttribute("data-filtered", empty);
		}

		for (const chip of chips) {
			const kind = chip.dataset.filterKind;
			const id = chip.dataset.filterId ?? "";
			if (kind === "category") {
				chip.hidden = !categoriesInMenu.has(id);
			} else if (kind === "tag") {
				chip.hidden = !tagsInMenu.has(id);
			}
			if (chip.hidden && chip.getAttribute("aria-pressed") === "true") {
				chip.setAttribute("aria-pressed", "false");
				if (kind === "category") selected.categories.delete(id);
				if (kind === "tag") selected.tags.delete(id);
			}
		}

		syncFilterGroups();

		if (emptyEl) emptyEl.hidden = inMenuCount > 0;

		const hasSelection = selected.categories.size > 0 || selected.tags.size > 0;
		for (const btn of clearBtns) {
			btn.hidden = !hasSelection;
		}

		filterTrigger?.classList.toggle("is-active", hasSelection);

		if (filterBar) {
			const anyChipVisible = chips.some((c) => !c.hidden);
			filterBar.hidden = !anyChipVisible && !hasSelection;
		}
	}

	function syncActiveMenuTitle(name: string) {
		if (activeMenuTitle && name) {
			activeMenuTitle.textContent = name;
		}
	}

	function clearFilters() {
		selected.categories.clear();
		selected.tags.clear();
		for (const chip of chips) {
			chip.setAttribute("aria-pressed", "false");
		}
	}

	function syncSwitcherUi(view: string) {
		const isLanding = view === "landing";
		const home = root.querySelector<HTMLAnchorElement>("[data-shell-home]");
		if (home) {
			home.classList.toggle("is-active", isLanding);
			if (isLanding) home.setAttribute("aria-current", "page");
			else home.removeAttribute("aria-current");
		}
		root.querySelectorAll<HTMLAnchorElement>("[data-menu-switch]").forEach((link) => {
			const active = !isLanding && link.dataset.menuId === activeMenuId;
			link.classList.toggle("is-active", active);
			if (active) link.setAttribute("aria-current", "page");
			else link.removeAttribute("aria-current");
		});
	}

	function setView(
		view: "landing" | "menu",
		push: boolean,
		menuMeta?: {
			menuId: string;
			slug: string;
			name: string;
		},
	) {
		currentView = view;
		root.dataset.view = view;

		if (landingView) landingView.hidden = view !== "landing";
		if (menuView) menuView.hidden = view !== "menu";

		if (view === "menu" && menuMeta) {
			activeMenuId = menuMeta.menuId;
			root.dataset.activeMenuId = menuMeta.menuId;
			syncActiveMenuTitle(menuMeta.name);
			clearFilters();
			applyVisibility();
			if (push && basePath && menuMeta.slug) {
				history.pushState(
					{ view: "menu", menuId: menuMeta.menuId, slug: menuMeta.slug },
					"",
					`${basePath}/${menuMeta.slug}`,
				);
			}
			if (restaurantName && menuMeta.name) {
				document.title = `${restaurantName} — ${menuMeta.name}`;
			}
		} else if (view === "landing") {
			clearFilters();
			if (push && basePath) {
				history.pushState({ view: "landing" }, "", basePath);
			}
			if (restaurantName) {
				document.title = restaurantName;
			}
		}

		syncSwitcherUi(view);
		window.scrollTo(0, 0);
		resetHeaderScroll();
	}

	function setActiveMenu(menuId: string, slug: string, name: string, push: boolean) {
		if (shellMode) {
			setView("menu", push, { menuId, slug, name });
			return;
		}
		activeMenuId = menuId;
		root.dataset.activeMenuId = menuId;
		syncActiveMenuTitle(name);
		syncSwitcherUi("menu");
		clearFilters();
		applyVisibility();
		if (push && basePath && slug) {
			history.pushState({ menuId, slug }, "", `${basePath}/${slug}`);
		}
		if (restaurantName && name) {
			document.title = `${restaurantName} — ${name}`;
		}
		resetHeaderScroll();
	}

	function toggleChip(btn: HTMLButtonElement) {
		const kind = btn.dataset.filterKind;
		const id = btn.dataset.filterId;
		if (!kind || !id || btn.hidden) return;

		const set = kind === "category" ? selected.categories : selected.tags;
		if (set.has(id)) {
			set.delete(id);
			btn.setAttribute("aria-pressed", "false");
		} else {
			set.add(id);
			btn.setAttribute("aria-pressed", "true");
		}
		applyVisibility();
	}

	for (const chip of chips) {
		chip.addEventListener("click", () => toggleChip(chip));
	}

	for (const btn of clearBtns) {
		btn.addEventListener("click", () => {
			clearFilters();
			applyVisibility();
		});
	}

	if (clientSwitch || shellMode) {
		root.querySelectorAll<HTMLAnchorElement>("[data-menu-switch]").forEach((link) => {
			link.addEventListener("click", (event) => {
				const menuId = link.dataset.menuId ?? "";
				const slug = link.dataset.menuSlug ?? "";
				const name = link.dataset.menuName ?? "";
				if (!menuId) return;
				if (!shellMode && menuId === activeMenuId && currentView === "menu") {
					event.preventDefault();
					return;
				}
				event.preventDefault();
				setActiveMenu(menuId, slug, name, true);
			});
		});

		root.querySelectorAll<HTMLAnchorElement>("[data-shell-open-menu]").forEach((link) => {
			link.addEventListener("click", (event) => {
				event.preventDefault();
				setActiveMenu(
					link.dataset.menuId ?? "",
					link.dataset.menuSlug ?? "",
					link.dataset.menuName ?? "",
					true,
				);
			});
		});

		root.querySelector<HTMLAnchorElement>("[data-shell-home]")?.addEventListener(
			"click",
			(event) => {
				if (!shellMode) return;
				event.preventDefault();
				if (currentView === "landing") return;
				setView("landing", true);
			},
		);

		window.addEventListener("popstate", () => {
			const path = location.pathname.replace(/\/$/, "") || "/";
			const base = basePath.replace(/\/$/, "");
			if (path === base) {
				if (shellMode) setView("landing", false);
				return;
			}
			const prefix = `${base}/`;
			if (!path.startsWith(prefix)) return;
			const slug = path.slice(prefix.length).split("/")[0] ?? "";
			const link =
				root.querySelector<HTMLAnchorElement>(
					`[data-menu-switch][data-menu-slug="${CSS.escape(slug)}"]`,
				) ??
				root.querySelector<HTMLAnchorElement>(
					`[data-shell-open-menu][data-menu-slug="${CSS.escape(slug)}"]`,
				);
			if (!link) return;
			setActiveMenu(link.dataset.menuId ?? "", slug, link.dataset.menuName ?? "", false);
		});
	}

	if (header) {
		window.addEventListener("scroll", onHeaderScroll, { passive: true });
	}

	applyVisibility();
	syncSwitcherUi(currentView);
}

export function bootPublicMenus() {
	document.querySelectorAll<HTMLElement>("[data-public-menu]").forEach(initPublicMenu);
}
