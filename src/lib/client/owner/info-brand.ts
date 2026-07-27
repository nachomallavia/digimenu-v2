/** Client bindings for `/app/info` logo previews + brand identity form. */

export function bindLogoPreviews(root: ParentNode = document) {
	const objectUrls = new Map<string, string>();

	for (const input of root.querySelectorAll<HTMLInputElement>("[data-logo-input]")) {
		const key = input.dataset.logoInput;
		if (!key) continue;
		if (input.dataset.bound === "1") continue;
		input.dataset.bound = "1";

		input.addEventListener("change", () => {
			const preview = root.querySelector<HTMLImageElement>(`[data-logo-preview="${key}"]`);
			const removeRow = root.querySelector<HTMLElement>(`[data-logo-remove="${key}"]`);
			if (!preview) return;

			const prev = objectUrls.get(key);
			if (prev) {
				URL.revokeObjectURL(prev);
				objectUrls.delete(key);
			}

			const file = input.files?.[0];
			if (!file) return;

			const url = URL.createObjectURL(file);
			objectUrls.set(key, url);
			preview.src = url;
			preview.classList.remove("hidden");
			removeRow?.classList.remove("hidden");
		});
	}
}

function bindColorSwatches(root: ParentNode) {
	for (const row of root.querySelectorAll<HTMLElement>("[data-brand-color-row]")) {
		if (row.dataset.swatchBound === "1") continue;
		row.dataset.swatchBound = "1";
		const swatch = row.querySelector<HTMLInputElement>("[data-brand-color-swatch]");
		const hex = row.querySelector<HTMLInputElement>("[data-brand-color-hex]");
		if (!swatch || !hex) continue;
		swatch.addEventListener("input", () => {
			hex.value = swatch.value;
		});
		hex.addEventListener("input", () => {
			if (/^#[0-9A-Fa-f]{6}$/.test(hex.value)) swatch.value = hex.value;
		});
	}
}

export function bindBrandForm(root: ParentNode = document) {
	const form = root.querySelector<HTMLFormElement>("[data-brand-form]");
	if (!form || form.dataset.bound === "1") return;
	form.dataset.bound = "1";

	const colorsList = form.querySelector<HTMLElement>("[data-brand-colors]");
	const fontsList = form.querySelector<HTMLElement>("[data-brand-fonts]");
	const colorTpl = document.querySelector<HTMLTemplateElement>("#brand-color-row-template");
	const fontTpl = document.querySelector<HTMLTemplateElement>("#brand-font-row-template");

	form.querySelector("[data-brand-add-color]")?.addEventListener("click", () => {
		if (!colorsList || !colorTpl) return;
		const node = colorTpl.content.cloneNode(true) as DocumentFragment;
		colorsList.appendChild(node);
		bindColorSwatches(colorsList);
	});

	form.querySelector("[data-brand-add-font]")?.addEventListener("click", () => {
		if (!fontsList || !fontTpl) return;
		fontsList.appendChild(fontTpl.content.cloneNode(true));
	});

	form.addEventListener("click", (event) => {
		const target = event.target as HTMLElement | null;
		const btn = target?.closest<HTMLButtonElement>("[data-brand-remove-row]");
		if (!btn) return;
		btn.closest("li")?.remove();
	});

	bindColorSwatches(form);
}
