import { actions } from "astro:actions";

/** Short debounce — one menu update covers the full membership set. */
const FLUSH_DEBOUNCE_MS = 400;

function foldSearchText(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.normalize("NFD")
		.replace(/\p{M}/gu, "");
}

function initMenuProducts() {
	const rootCandidate = document.querySelector("[data-menu-products]");
	if (!(rootCandidate instanceof HTMLElement) || rootCandidate.dataset.bound === "1") {
		return;
	}
	const rootEl: HTMLElement = rootCandidate;
	rootEl.dataset.bound = "1";

	const menuId = rootEl.dataset.menuId ?? "";
	if (!menuId) return;

	const searchInput = rootEl.querySelector<HTMLInputElement>("[data-menu-products-search]");
	const categorySelect = rootEl.querySelector<HTMLSelectElement>("[data-menu-products-category]");
	const list = rootEl.querySelector<HTMLElement>("[data-menu-products-list]");
	const emptyEl = rootEl.querySelector<HTMLElement>("[data-menu-products-empty]");
	const assignedLabel = rootEl.querySelector<HTMLElement>("[data-assigned-label]");
	const statusEl = rootEl.querySelector<HTMLElement>("[data-menu-products-status]");
	const toast = rootEl.querySelector<HTMLElement>("[data-menu-products-toast]");
	const assignAll = rootEl.querySelector<HTMLInputElement>("[data-menu-assign-all]");

	let searchQuery = "";
	let categoryFilter = "";
	let matchedRows: HTMLElement[] = [];

	let dirty = false;
	let flushTimer: ReturnType<typeof setTimeout> | undefined;
	let flushing = false;
	let lastSavedChecked = new Map<string, boolean>();

	function rows(): HTMLElement[] {
		return Array.from(rootEl.querySelectorAll<HTMLElement>("[data-menu-product-row]"));
	}

	function captureChecked(): Map<string, boolean> {
		const map = new Map<string, boolean>();
		for (const row of rows()) {
			const input = row.querySelector<HTMLInputElement>("[data-menu-assign]");
			const id = input?.dataset.productId ?? "";
			if (id && input) map.set(id, input.checked);
		}
		return map;
	}

	lastSavedChecked = captureChecked();

	function setStatus(text: string, visible: boolean) {
		if (!statusEl) return;
		statusEl.textContent = text;
		statusEl.hidden = !visible;
	}

	function updateAssignedLabel() {
		if (!assignedLabel) return;
		const total = rows().length;
		const assigned = rows().filter(
			(row) => row.querySelector<HTMLInputElement>("[data-menu-assign]")?.checked,
		).length;
		assignedLabel.textContent = ` ${assigned} de ${total} asignados.`;
		rootEl.dataset.assignedCount = String(assigned);
	}

	function syncAssignAllState() {
		if (!assignAll) return;
		const targets = matchedRows;
		if (targets.length === 0) {
			assignAll.checked = false;
			assignAll.indeterminate = false;
			return;
		}
		let checkedCount = 0;
		for (const row of targets) {
			if (row.querySelector<HTMLInputElement>("[data-menu-assign]")?.checked) {
				checkedCount += 1;
			}
		}
		assignAll.checked = checkedCount === targets.length;
		assignAll.indeterminate = checkedCount > 0 && checkedCount < targets.length;
	}

	function applyListView() {
		const query = foldSearchText(searchQuery);
		const all = rows();
		const matched: HTMLElement[] = [];

		for (const row of all) {
			const nombre = foldSearchText(row.dataset.nombre ?? "");
			const catId = row.dataset.categoriaId ?? "";
			let catOk = true;
			if (categoryFilter === "__none") {
				catOk = !catId;
			} else if (categoryFilter) {
				catOk = catId === categoryFilter;
			}
			const match = (!query || nombre.includes(query)) && catOk;
			row.hidden = !match;
			if (match) matched.push(row);
		}

		matched.sort(
			(a, b) => Number(a.dataset.sortIndex ?? 0) - Number(b.dataset.sortIndex ?? 0),
		);
		if (list) {
			for (const row of matched) list.appendChild(row);
		}

		matchedRows = matched;
		const filtersActive = Boolean(query) || Boolean(categoryFilter);
		if (emptyEl) {
			emptyEl.hidden = !(filtersActive && all.length > 0 && matched.length === 0);
		}
		syncAssignAllState();
	}

	function scheduleFlush() {
		dirty = true;
		clearTimeout(flushTimer);
		setStatus("Cambios pendientes…", true);
		flushTimer = setTimeout(() => {
			void flush();
		}, FLUSH_DEBOUNCE_MS);
	}

	function revertToLastSaved() {
		for (const [productId, checked] of lastSavedChecked) {
			const input = rootEl.querySelector<HTMLInputElement>(
				`[data-menu-assign][data-product-id="${CSS.escape(productId)}"]`,
			);
			if (input) input.checked = checked;
		}
		updateAssignedLabel();
		syncAssignAllState();
	}

	async function flush() {
		if (flushing || !dirty) return;
		flushing = true;
		clearTimeout(flushTimer);
		dirty = false;
		if (toast) {
			toast.hidden = true;
			toast.textContent = "";
		}

		const productIds = rows()
			.map((row) => {
				const input = row.querySelector<HTMLInputElement>("[data-menu-assign]");
				if (!input?.checked) return null;
				return input.dataset.productId ?? null;
			})
			.filter((id): id is string => Boolean(id));

		setStatus("Guardando…", true);
		try {
			const { error } = await actions.menus.setProducts({
				menuId,
				productIds,
			});
			if (error) {
				throw new Error(error.message || "No se pudo actualizar");
			}
			lastSavedChecked = captureChecked();
			updateAssignedLabel();
			syncAssignAllState();
		} catch (err) {
			if (toast) {
				toast.hidden = false;
				toast.textContent =
					err instanceof Error ? err.message : "No se pudo actualizar";
			}
			revertToLastSaved();
		} finally {
			flushing = false;
			if (dirty) {
				scheduleFlush();
			} else {
				setStatus("", false);
			}
		}
	}

	searchInput?.addEventListener("input", () => {
		searchQuery = searchInput.value;
		applyListView();
	});

	categorySelect?.addEventListener("change", () => {
		categoryFilter = categorySelect.value;
		applyListView();
	});

	rootEl.addEventListener("change", (event) => {
		const target = event.target as HTMLElement | null;
		const allInput = target?.closest<HTMLInputElement>("[data-menu-assign-all]");
		if (allInput) {
			const assigned = allInput.checked;
			for (const row of matchedRows) {
				const input = row.querySelector<HTMLInputElement>("[data-menu-assign]");
				if (!input) continue;
				input.checked = assigned;
			}
			updateAssignedLabel();
			syncAssignAllState();
			scheduleFlush();
			return;
		}

		const input = target?.closest<HTMLInputElement>("[data-menu-assign]");
		if (!input) return;
		updateAssignedLabel();
		syncAssignAllState();
		scheduleFlush();
	});

	function flushOnLeave() {
		if (!dirty) return;
		clearTimeout(flushTimer);
		void flush();
	}

	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "hidden") flushOnLeave();
	});
	window.addEventListener("pagehide", flushOnLeave);

	updateAssignedLabel();
	applyListView();
}

/** Bind menu product assignment UI (idempotent via data-bound). */
export function bootMenuProducts() {
	initMenuProducts();
}
