/**
 * Product CSV download / preview / confirm import (DIG-21).
 */
import { actions } from "astro:actions";

type NameSimilar = { id: string; name: string; distance: number };
type NewNamePreview = {
	key: string;
	displayName: string;
	similar: NameSimilar[];
};
type NameResolution = { action: "create" } | { action: "use"; id: string };

type CsvToast = (type: "success" | "error", message: string) => void;

function openCsvDialog(dialog: HTMLElement) {
	dialog.dispatchEvent(new CustomEvent("dialog:open"));
}

function closeCsvDialog(dialog: HTMLElement) {
	dialog.dispatchEvent(new CustomEvent("dialog:close"));
}

function renderNewProductos(
	section: HTMLElement | null,
	list: HTMLElement | null,
	heading: HTMLElement | null,
	names: string[],
) {
	if (!section || !list || !heading) return;
	if (names.length === 0) {
		section.hidden = true;
		return;
	}
	section.hidden = false;
	heading.textContent =
		names.length === 1
			? "Se creará 1 producto nuevo"
			: `Se crearán ${names.length} productos nuevos`;
	list.replaceChildren();
	const shown = names.slice(0, 12);
	for (const name of shown) {
		const li = document.createElement("li");
		li.textContent = name;
		list.append(li);
	}
	if (names.length > shown.length) {
		const li = document.createElement("li");
		li.textContent = `…y ${names.length - shown.length} más`;
		list.append(li);
	}
}

function renderNameResolutions(
	section: HTMLElement | null,
	list: HTMLElement | null,
	items: NewNamePreview[],
	dataAttr: string,
) {
	if (!section || !list) return;
	if (items.length === 0) {
		section.hidden = true;
		list.replaceChildren();
		return;
	}
	section.hidden = false;
	list.replaceChildren();
	for (const item of items) {
		const wrap = document.createElement("div");
		wrap.className = "flex flex-col gap-1.5 rounded-md border border-border p-3";
		const label = document.createElement("p");
		label.className = "text-sm font-medium";
		label.textContent = item.displayName;
		const select = document.createElement("select");
		select.className =
			"border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs focus-visible:ring-1 focus-visible:outline-none";
		select.setAttribute(dataAttr, item.key);
		const createOpt = document.createElement("option");
		createOpt.value = "create";
		createOpt.textContent = `Crear «${item.displayName}»`;
		select.append(createOpt);
		for (const sim of item.similar) {
			const opt = document.createElement("option");
			opt.value = `use:${sim.id}`;
			opt.textContent = `Usar «${sim.name}»`;
			select.append(opt);
		}
		select.value =
			item.similar.length > 0 ? `use:${item.similar[0]!.id}` : "create";
		wrap.append(label, select);
		list.append(wrap);
	}
}

function collectResolutions(
	list: HTMLElement | null,
	dataAttr: string,
): Record<string, NameResolution> {
	const out: Record<string, NameResolution> = {};
	list?.querySelectorAll<HTMLSelectElement>(`select[${dataAttr}]`).forEach((sel) => {
		const key = sel.getAttribute(dataAttr);
		if (!key) return;
		const v = sel.value;
		if (v.startsWith("use:")) {
			out[key] = { action: "use", id: v.slice(4) };
		} else {
			out[key] = { action: "create" };
		}
	});
	return out;
}

export function bindProductsCsv(
	root: HTMLElement,
	showToast: CsvToast = () => {},
): void {
	const csvDownloadBtn = root.querySelector<HTMLButtonElement>("[data-csv-download]");
	const csvUploadBtn = root.querySelector<HTMLButtonElement>("[data-csv-upload]");
	const csvFileInput = root.querySelector<HTMLInputElement>("[data-csv-file]");
	const csvDialog = document.querySelector<HTMLElement>("[data-csv-confirm-dialog]");
	const csvCatsList = csvDialog?.querySelector<HTMLElement>("[data-csv-categorias-list]");
	const csvCatsSection = csvDialog?.querySelector<HTMLElement>(
		"[data-csv-categorias-section]",
	);
	const csvTagsList = csvDialog?.querySelector<HTMLElement>("[data-csv-etiquetas-list]");
	const csvTagsSection = csvDialog?.querySelector<HTMLElement>(
		"[data-csv-etiquetas-section]",
	);
	const csvProductosSection = csvDialog?.querySelector<HTMLElement>(
		"[data-csv-new-productos-section]",
	);
	const csvProductosList = csvDialog?.querySelector<HTMLElement>(
		"[data-csv-new-productos-list]",
	);
	const csvProductosHeading = csvDialog?.querySelector<HTMLElement>(
		"[data-csv-new-productos-heading]",
	);
	const csvConfirmBtn = csvDialog?.querySelector<HTMLButtonElement>(
		"[data-csv-confirm-continue]",
	);

	let pendingCsvText: string | null = null;
	let csvBusy = false;

	const csvToastRaw = sessionStorage.getItem("digimenu-csv-toast");
	if (csvToastRaw) {
		sessionStorage.removeItem("digimenu-csv-toast");
		try {
			const t = JSON.parse(csvToastRaw) as {
				type: "success" | "error";
				message: string;
			};
			if (t?.message) showToast(t.type === "error" ? "error" : "success", t.message);
		} catch {
			/* ignore */
		}
	}

	async function downloadProductosCsv() {
		if (csvBusy) return;
		csvBusy = true;
		try {
			const { data, error } = await actions.products.exportCsv({});
			if (error) throw new Error(error.message || "No se pudo descargar");
			const csv = data?.csv ?? "";
			const filename = data?.filename ?? "productos.csv";
			const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = filename;
			a.click();
			URL.revokeObjectURL(url);
			showToast("success", "CSV descargado.");
		} catch (err) {
			showToast("error", err instanceof Error ? err.message : "No se pudo descargar");
		} finally {
			csvBusy = false;
		}
	}

	async function runCsvImport(
		categoriaResolutions: Record<string, NameResolution>,
		etiquetaResolutions: Record<string, NameResolution>,
	) {
		if (!pendingCsvText || csvBusy) return;
		csvBusy = true;
		try {
			const { data, error } = await actions.products.importCsv({
				csv: pendingCsvText,
				categoriaResolutions,
				etiquetaResolutions,
			});
			pendingCsvText = null;
			if (csvDialog) closeCsvDialog(csvDialog);
			if (error) throw new Error(error.message || "No se pudo importar");

			const created = data?.created ?? 0;
			const updated = data?.updated ?? 0;
			const cats = data?.categoriesCreated ?? 0;
			const tags = data?.tagsCreated ?? 0;
			const failCount = data?.failed?.length ?? 0;
			const parts = [
				created ? `${created} creados` : null,
				updated ? `${updated} actualizados` : null,
				cats ? `${cats} categorías nuevas` : null,
				tags ? `${tags} etiquetas nuevas` : null,
			].filter(Boolean);
			const message =
				failCount === 0
					? parts.length
						? `Importación OK: ${parts.join(", ")}.`
						: "Nada que importar."
					: `${parts.join(", ") || "Parcial"}; ${failCount} fila(s) fallaron` +
						(data?.failed?.[0]
							? ` (fila ${data.failed[0].row}: ${data.failed[0].error})`
							: ".");

			if (created + updated + cats + tags > 0) {
				sessionStorage.setItem(
					"digimenu-csv-toast",
					JSON.stringify({
						type: failCount === 0 ? "success" : "error",
						message,
					}),
				);
				window.location.reload();
			} else if (failCount === 0) {
				showToast("success", message);
			} else {
				showToast("error", message);
			}
		} catch (err) {
			showToast("error", err instanceof Error ? err.message : "No se pudo importar");
		} finally {
			csvBusy = false;
		}
	}

	async function handleCsvFile(file: File) {
		if (csvBusy) return;
		const text = await file.text();
		pendingCsvText = text;
		csvBusy = true;
		try {
			const { data, error } = await actions.products.previewCsvImport({ csv: text });
			csvBusy = false;
			if (error) throw new Error(error.message || "CSV inválido");

			const news = data?.newCategorias ?? [];
			const newTags = data?.newEtiquetas ?? [];
			const newProductos = data?.newProductos ?? [];
			if (news.length === 0 && newTags.length === 0 && newProductos.length === 0) {
				await runCsvImport({}, {});
				return;
			}
			renderNewProductos(
				csvProductosSection ?? null,
				csvProductosList ?? null,
				csvProductosHeading ?? null,
				newProductos,
			);
			renderNameResolutions(
				csvCatsSection ?? null,
				csvCatsList ?? null,
				news,
				"data-csv-cat-key",
			);
			renderNameResolutions(
				csvTagsSection ?? null,
				csvTagsList ?? null,
				newTags,
				"data-csv-tag-key",
			);
			if (csvDialog) openCsvDialog(csvDialog);
		} catch (err) {
			pendingCsvText = null;
			csvBusy = false;
			showToast("error", err instanceof Error ? err.message : "CSV inválido");
		}
	}

	csvDownloadBtn?.addEventListener("click", () => {
		void downloadProductosCsv();
	});
	csvUploadBtn?.addEventListener("click", () => {
		if (csvBusy) return;
		csvFileInput?.click();
	});
	csvFileInput?.addEventListener("change", () => {
		const file = csvFileInput.files?.[0];
		csvFileInput.value = "";
		if (file) void handleCsvFile(file);
	});
	csvConfirmBtn?.addEventListener("click", () => {
		void runCsvImport(
			collectResolutions(csvCatsList ?? null, "data-csv-cat-key"),
			collectResolutions(csvTagsList ?? null, "data-csv-tag-key"),
		);
	});
	csvDialog?.querySelector("dialog")?.addEventListener("close", () => {
		if (!csvBusy) pendingCsvText = null;
	});
}
