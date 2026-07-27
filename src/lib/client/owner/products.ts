import { atom, computed, map, type MapStore, type ReadableAtom } from "nanostores";
import { actions } from "astro:actions";

/** Scalar patch values used in owner list editors. */
type PatchValue = string | number | boolean | null;

export type ProductPatch = {
	name?: string;
	price?: number;
	category_id?: string | null;
};

export type ProductField = keyof ProductPatch;

export const pending = map<Record<string, ProductPatch>>({});
export const fieldErrors = map<Record<string, Partial<Record<ProductField, string>>>>({});
export const saving = atom(false);
export const searchQuery = atom("");
export const categoryFilter = atom("");
export const toast = atom<{ type: "success" | "error"; message: string } | null>(null);

function valuesEqual(a: PatchValue | undefined, b: PatchValue | undefined): boolean {
	if (a === b) return true;
	if ((a === null || a === undefined) && (b === null || b === undefined)) return true;
	return false;
}

function setField(
	store: MapStore<Record<string, ProductPatch>>,
	id: string,
	key: ProductField,
	value: ProductPatch[ProductField],
	original: PatchValue | undefined,
): void {
	const next = { ...store.get() };
	const current = { ...(next[id] ?? {}) };

	if (valuesEqual(value as PatchValue, original)) {
		delete current[key];
	} else {
		current[key] = value as never;
	}

	if (Object.keys(current).length === 0) {
		delete next[id];
	} else {
		next[id] = current;
	}
	store.set(next);
}

export const productsPendingCount: ReadableAtom<number> = computed(
	pending,
	(m) => Object.keys(m).length,
);

export const productsHasFieldErrors: ReadableAtom<boolean> = computed(fieldErrors, (m) =>
	Object.values(m).some((fields) => Object.keys(fields).length > 0),
);

export function showToast(type: "success" | "error", message: string): void {
	toast.set({ type, message });
}

export function setProductFieldError(
	id: string,
	field: ProductField,
	message: string | null,
): void {
	const next = { ...fieldErrors.get() };
	const row = { ...(next[id] ?? {}) };
	if (message) {
		row[field] = message;
	} else {
		delete row[field];
	}
	if (Object.keys(row).length === 0) {
		delete next[id];
	} else {
		next[id] = row;
	}
	fieldErrors.set(next);
}

export function setProductField(
	id: string,
	field: ProductField,
	value: ProductPatch[ProductField],
	original: PatchValue | undefined,
): void {
	setField(pending, id, field, value, original);
}

export function discardProductEdits(): void {
	pending.set({});
	fieldErrors.set({});
}

export function dropProductPending(id: string): void {
	const next = { ...pending.get() };
	delete next[id];
	pending.set(next);
	const errs = { ...fieldErrors.get() };
	delete errs[id];
	fieldErrors.set(errs);
}

export function markProductsSaved(ids: string[]): void {
	const nextPending = { ...pending.get() };
	const nextErrors = { ...fieldErrors.get() };
	for (const id of ids) {
		delete nextPending[id];
		delete nextErrors[id];
	}
	pending.set(nextPending);
	fieldErrors.set(nextErrors);
}

function foldSearchText(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.normalize("NFD")
		.replace(/\p{M}/gu, "");
}

function bindToastHost(host: HTMLElement) {
	toast.subscribe((t) => {
		const msg = host.querySelector<HTMLElement>("[data-owner-toast-message]");
		if (!t) {
			host.hidden = true;
			if (msg) msg.textContent = "";
			return;
		}
		host.hidden = false;
		host.dataset.toastType = t.type;
		if (msg) msg.textContent = t.message;
		window.setTimeout(() => {
			if (toast.get()?.message === t.message) toast.set(null);
		}, 3500);
	});
}

/** Boot entry for the productos list editor (idempotent via data-bound). */
export function bootProductosEditor(): void {
	const rootEl = document.querySelector<HTMLElement>("[data-productos-editor]");
	if (!rootEl || rootEl.dataset.bound === "1") return;
	rootEl.dataset.bound = "1";
	const root = rootEl;

	const sticky = root.querySelector<HTMLElement>("[data-productos-sticky]");
	const stickyLabel = root.querySelector<HTMLElement>("[data-sticky-label]");
	const saveBtn = root.querySelector<HTMLButtonElement>("[data-save-edits]");
	const discardBtn = root.querySelector<HTMLButtonElement>("[data-discard-edits]");
	const tbody = root.querySelector<HTMLElement>("[data-productos-tbody]");
	const toastHost = root.querySelector<HTMLElement>("[data-owner-toast]");
	const searchInput = root.querySelector<HTMLInputElement>("[data-productos-search]");
	const searchEmpty = root.querySelector<HTMLElement>("[data-productos-search-empty]");
	const categorySelect = root.querySelector<HTMLSelectElement>("[data-productos-category]");
	const rowImageInput = root.querySelector<HTMLInputElement>("[data-row-image-file]");

	if (toastHost) bindToastHost(toastHost);

	searchQuery.set("");
	categoryFilter.set("");
	pending.set({});
	fieldErrors.set({});
	saving.set(false);
	if (searchInput) searchInput.value = "";
	if (categorySelect) categorySelect.value = "";

	root.querySelectorAll<HTMLElement>("[data-producto-row]").forEach((row, i) => {
		row.dataset.sortIndex = String(i);
	});

	let categoriaIds = new Set<string>();
	try {
		const parsed = JSON.parse(root.dataset.categoriaIds ?? "[]") as unknown;
		if (Array.isArray(parsed)) {
			categoriaIds = new Set(parsed.map(String));
		}
	} catch {
		categoriaIds = new Set();
	}

	function originalOf(el: HTMLElement): string {
		return el.dataset.original ?? "";
	}

	function applyListView() {
		const query = foldSearchText(searchQuery.get());
		const catFilter = categoryFilter.get();
		const rows = Array.from(root.querySelectorAll<HTMLElement>("[data-producto-row]"));
		let matched = 0;

		for (const row of rows) {
			const nombreEl = row.querySelector<HTMLInputElement>('[data-field="name"]');
			const nombre = foldSearchText(nombreEl?.value ?? "");
			const catEl = row.querySelector<HTMLSelectElement>('[data-field="category_id"]');
			const catId = catEl?.value ?? "";
			let catOk = true;
			if (catFilter === "__none") {
				catOk = !catId;
			} else if (catFilter) {
				catOk = catId === catFilter;
			}
			const match = (!query || nombre.includes(query)) && catOk;
			row.hidden = !match;
			if (match) matched += 1;
		}

		if (searchEmpty) {
			const filtersActive = Boolean(query) || Boolean(catFilter);
			searchEmpty.hidden = !(filtersActive && rows.length > 0 && matched === 0);
		}
	}

	function syncDirtyRows() {
		const mapPending = pending.get();
		root.querySelectorAll<HTMLElement>("[data-producto-row]").forEach((row) => {
			const id = row.dataset.productoRow;
			if (!id) return;
			row.toggleAttribute("data-dirty", Boolean(mapPending[id]));
			row.classList.toggle("bg-muted/40", Boolean(mapPending[id]));
		});
	}

	function syncFieldErrorStyles() {
		const errs = fieldErrors.get();
		root.querySelectorAll<HTMLElement>("[data-field]").forEach((el) => {
			const id = el.dataset.productoId;
			const field = el.dataset.field as ProductField | undefined;
			if (!id || !field) return;
			const hasErr = Boolean(errs[id]?.[field]);
			el.classList.toggle("border-error", hasErr);
			el.setAttribute("aria-invalid", hasErr ? "true" : "false");
		});
	}

	function updateSticky() {
		if (!sticky || !stickyLabel || !saveBtn || !discardBtn) return;
		const n = productsPendingCount.get();
		const isSaving = saving.get();
		const hasErrors = productsHasFieldErrors.get();
		sticky.hidden = n === 0 && !isSaving;
		stickyLabel.textContent = isSaving
			? "Guardando…"
			: `Guardar ${n} cambio${n === 1 ? "" : "s"}`;
		saveBtn.disabled = n === 0 || isSaving || hasErrors;
		discardBtn.disabled = isSaving || n === 0;
		syncDirtyRows();
		syncFieldErrorStyles();
	}

	productsPendingCount.subscribe(updateSticky);
	saving.subscribe(updateSticky);
	productsHasFieldErrors.subscribe(updateSticky);
	fieldErrors.subscribe(syncFieldErrorStyles);
	pending.subscribe(syncDirtyRows);
	searchQuery.subscribe(applyListView);
	categoryFilter.subscribe(applyListView);
	updateSticky();
	applyListView();

	function applyField(el: HTMLInputElement | HTMLSelectElement) {
		const id = el.dataset.productoId;
		const field = el.dataset.field as ProductField | undefined;
		if (!id || !field) return;

		if (field === "name") {
			const trimmed = el.value.trim();
			const original = originalOf(el);
			if (!trimmed) {
				setProductFieldError(id, "name", "Nombre obligatorio");
				setProductField(id, "name", original, original);
				applyListView();
				return;
			}
			setProductFieldError(id, "name", null);
			setProductField(id, "name", trimmed, original);
			applyListView();
			return;
		}

		if (field === "price") {
			const precio = Number(el.value);
			const original = Number(originalOf(el));
			if (!Number.isFinite(precio) || precio < 0) {
				setProductFieldError(id, "price", "Precio inválido");
				setProductField(id, "price", original, original);
				return;
			}
			const rounded = Math.round(precio * 100) / 100;
			setProductFieldError(id, "price", null);
			setProductField(id, "price", rounded, original);
			applyListView();
			return;
		}

		if (field === "category_id") {
			const raw = el.value;
			const value = raw === "" ? null : raw;
			const originalRaw = originalOf(el);
			const original = originalRaw === "" ? null : originalRaw;
			if (value !== null && !categoriaIds.has(value)) {
				setProductFieldError(id, "category_id", "Categoría inválida");
				setProductField(id, "category_id", original, original);
				applyListView();
				return;
			}
			setProductFieldError(id, "category_id", null);
			setProductField(id, "category_id", value, original);
			applyListView();
		}
	}

	tbody?.addEventListener("change", (e) => {
		const t = e.target;
		if (!(t instanceof HTMLInputElement || t instanceof HTMLSelectElement)) return;
		if (!t.dataset.field) return;
		applyField(t);
	});

	tbody?.addEventListener(
		"blur",
		(e) => {
			const t = e.target;
			if (!(t instanceof HTMLInputElement)) return;
			if (!t.dataset.field) return;
			applyField(t);
		},
		true,
	);

	searchInput?.addEventListener("input", () => {
		searchQuery.set(searchInput.value);
	});

	categorySelect?.addEventListener("change", () => {
		categoryFilter.set(categorySelect.value);
	});

	function restoreDomFromOriginals() {
		root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-field]").forEach((el) => {
			const field = el.dataset.field;
			const original = originalOf(el);
			if (field === "name" || field === "price" || field === "category_id") {
				el.value = original;
			}
		});
	}

	function syncOriginalsFromPatch(id: string, patch: ProductPatch) {
		const row = root.querySelector<HTMLElement>(`[data-producto-row="${id}"]`);
		if (!row) return;
		if (patch.name !== undefined) {
			const el = row.querySelector<HTMLInputElement>('[data-field="name"]');
			if (el) {
				el.dataset.original = patch.name;
				el.value = patch.name;
			}
		}
		if (patch.price !== undefined) {
			const el = row.querySelector<HTMLInputElement>('[data-field="price"]');
			if (el) {
				el.dataset.original = String(patch.price);
				el.value = String(patch.price);
			}
		}
		if (patch.category_id !== undefined) {
			const el = row.querySelector<HTMLSelectElement>('[data-field="category_id"]');
			if (el) {
				const v = patch.category_id ?? "";
				el.dataset.original = v;
				el.value = v;
			}
		}
	}

	discardBtn?.addEventListener("click", () => {
		if (saving.get()) return;
		restoreDomFromOriginals();
		discardProductEdits();
		updateSticky();
	});

	saveBtn?.addEventListener("click", async () => {
		if (saving.get()) return;
		if (productsHasFieldErrors.get()) {
			showToast("error", "Corregí los campos inválidos antes de guardar.");
			return;
		}
		const changes = pending.get();
		const ids = Object.keys(changes);
		if (ids.length === 0) return;

		saving.set(true);
		try {
			const { data, error } = await actions.products.batchUpdate({ changes });
			if (error) {
				throw new Error(error.message || "No se pudieron guardar los cambios.");
			}
			const result = data ?? { ok: false, updated: 0, failed: [] };
			const failedIds = new Set((result.failed ?? []).map((f) => f.id));
			const savedIds = ids.filter((id) => !failedIds.has(id));

			for (const id of savedIds) {
				const patch = changes[id];
				if (patch) syncOriginalsFromPatch(id, patch);
			}
			markProductsSaved(savedIds);

			if (result.ok) {
				showToast(
					"success",
					`${result.updated} producto${result.updated === 1 ? "" : "s"} actualizado${result.updated === 1 ? "" : "s"}.`,
				);
			} else {
				const failCount = result.failed?.length ?? 0;
				showToast(
					"error",
					failCount
						? `${result.updated} guardados, ${failCount} fallaron.`
						: "No se pudieron guardar los cambios.",
				);
			}
		} catch (err) {
			showToast("error", err instanceof Error ? err.message : "Error de red");
		} finally {
			saving.set(false);
		}
	});

	let pendingImageUpload: { id: string } | null = null;

	root.addEventListener("click", async (e) => {
		const uploadBtn = (e.target as HTMLElement).closest<HTMLElement>(
			"[data-upload-image-id]",
		);
		if (uploadBtn && !saving.get()) {
			e.preventDefault();
			const id = uploadBtn.dataset.uploadImageId;
			if (!id || !rowImageInput) return;
			pendingImageUpload = { id };
			rowImageInput.value = "";
			rowImageInput.click();
			return;
		}

		const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-delete-id]");
		if (!btn || saving.get()) return;
		e.preventDefault();
		const id = btn.dataset.deleteId;
		const name = btn.dataset.deleteName ?? "este producto";
		if (!id) return;
		if (!confirm(`¿Eliminar “${name}”? Esta acción no se puede deshacer.`)) return;

		try {
			const { error } = await actions.products.deleteJson({ id });
			if (error) {
				showToast("error", error.message ?? "No se pudo eliminar");
				return;
			}
			dropProductPending(id);
			root.querySelector(`[data-producto-row="${id}"]`)?.remove();
			applyListView();
			showToast("success", "Producto eliminado.");
		} catch (err) {
			showToast("error", err instanceof Error ? err.message : "Error de red");
		}
	});

	rowImageInput?.addEventListener("change", async () => {
		const file = rowImageInput.files?.[0];
		const target = pendingImageUpload;
		rowImageInput.value = "";
		pendingImageUpload = null;
		if (!file || !target || saving.get()) return;

		saving.set(true);
		try {
			const body = new FormData();
			body.append("id", target.id);
			body.append("image", file, file.name || "imagen");
			const { error } = await actions.products.uploadImage(body);
			if (error) {
				throw new Error(error.message || "No se pudo subir la imagen");
			}
			showToast("success", "Imagen actualizada.");
		} catch (err) {
			showToast("error", err instanceof Error ? err.message : "No se pudo subir la imagen");
		} finally {
			saving.set(false);
		}
	});

	window.addEventListener("beforeunload", (e) => {
		if (productsPendingCount.get() > 0) {
			e.preventDefault();
			e.returnValue = "";
		}
	});
}
