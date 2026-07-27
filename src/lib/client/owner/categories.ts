import type { SelectChangeEvent } from "@/components/starwind/select";

const PRIMARY_CLASSES = [
	"bg-primary",
	"text-primary-foreground",
	"hover:bg-primary/90",
	"focus-visible:ring-primary/50",
] as const;

const OUTLINE_CLASSES = [
	"dark:border-input",
	"focus-visible:ring-outline/50",
	"bg-background",
	"dark:bg-input/30",
	"focus-visible:border-outline",
	"hover:bg-muted",
	"dark:hover:bg-input/50",
	"hover:text-foreground",
	"border",
	"shadow-xs",
] as const;

function setSaveButtonDirty(btn: HTMLButtonElement, dirty: boolean): void {
	btn.disabled = !dirty;
	btn.toggleAttribute("data-dirty", dirty);
	if (dirty) {
		btn.classList.remove(...OUTLINE_CLASSES);
		btn.classList.add(...PRIMARY_CLASSES);
	} else {
		btn.classList.remove(...PRIMARY_CLASSES);
		btn.classList.add(...OUTLINE_CLASSES);
	}
}

function showIconPreview(card: HTMLElement, iconId: string) {
	const root = card.querySelector<HTMLElement>("[data-icon-preview]");
	if (!root) return;
	root.querySelectorAll<HTMLElement>("[data-icon-id]").forEach((el) => {
		const match = el.dataset.iconId === iconId;
		el.classList.toggle("hidden", !match);
		el.classList.toggle("inline-flex", match);
	});
}

function isDirty(card: HTMLElement): boolean {
	const originalName = card.dataset.originalName ?? "";
	const originalIcon = card.dataset.originalIcon ?? "";
	const hasOriginalCover = card.dataset.originalHasCover === "1";

	const nameInput = card.querySelector<HTMLInputElement>('[data-field="name"]');
	const iconField = card.querySelector<HTMLSelectElement>('select[name="icon"]');
	const coverInput = card.querySelector<HTMLInputElement>('[data-field="cover"]');
	const removeInput = card.querySelector<HTMLInputElement>('[data-field="remove_cover"]');

	const name = nameInput?.value.trim() ?? "";
	const icon = iconField?.value ?? originalIcon;
	const hasNewCover = Boolean(coverInput?.files?.[0]);
	const removing = removeInput?.value === "1";

	if (name !== originalName) return true;
	if ((icon || "") !== originalIcon) return true;
	if (hasNewCover) return true;
	if (removing && hasOriginalCover) return true;
	return false;
}

function syncCoverPreview(card: HTMLElement) {
	const img = card.querySelector<HTMLImageElement>("[data-cover-preview]");
	const actions = card.querySelector<HTMLElement>("[data-remove-cover-actions]");
	const idle = card.querySelector<HTMLElement>("[data-remove-cover-idle]");
	const pendingUi = card.querySelector<HTMLElement>("[data-remove-cover-pending]");
	const removeInput = card.querySelector<HTMLInputElement>('[data-field="remove_cover"]');
	const coverInput = card.querySelector<HTMLInputElement>('[data-field="cover"]');
	if (!img) return;

	const originalSrc = card.dataset.originalCoverSrc ?? "";
	const hasOriginal = card.dataset.originalHasCover === "1";
	const removing = removeInput?.value === "1";
	const file = coverInput?.files?.[0];

	let src = "";
	if (file) {
		src = card.dataset.coverObjectUrl ?? "";
		if (!src) {
			src = URL.createObjectURL(file);
			card.dataset.coverObjectUrl = src;
		}
	} else if (!removing) {
		src = originalSrc;
	}

	if (src) {
		img.src = src;
		img.hidden = false;
	} else {
		img.removeAttribute("src");
		img.hidden = true;
	}

	if (actions) actions.classList.toggle("hidden", !hasOriginal);
	if (idle) idle.classList.toggle("hidden", removing);
	if (pendingUi) pendingUi.classList.toggle("hidden", !removing);
	if (removeInput && !hasOriginal) removeInput.value = "";
}

function syncCard(card: HTMLElement) {
	const saveBtn = card.querySelector<HTMLButtonElement>("[data-save-category]");
	if (saveBtn) setSaveButtonDirty(saveBtn, isDirty(card));
	syncCoverPreview(card);
}

function revokeCoverObjectUrl(card: HTMLElement) {
	const url = card.dataset.coverObjectUrl;
	if (url) {
		URL.revokeObjectURL(url);
		delete card.dataset.coverObjectUrl;
	}
}

function bindCard(card: HTMLElement) {
	if (card.dataset.bound === "1") return;
	card.dataset.bound = "1";
	syncCard(card);

	const nameInput = card.querySelector<HTMLInputElement>('[data-field="name"]');
	const iconSelect = card.querySelector<HTMLElement>('[data-field="icon"]');
	const coverInput = card.querySelector<HTMLInputElement>('[data-field="cover"]');
	const coverPick = card.querySelector<HTMLButtonElement>("[data-cover-pick]");
	const coverFilename = card.querySelector<HTMLElement>("[data-cover-filename]");
	const removeInput = card.querySelector<HTMLInputElement>('[data-field="remove_cover"]');
	const confirmRemove = card.querySelector<HTMLButtonElement>("[data-confirm-remove-cover]");
	const undoRemove = card.querySelector<HTMLButtonElement>("[data-undo-remove-cover]");

	function setCoverFilename(name: string | null) {
		if (!coverFilename) return;
		coverFilename.textContent = name?.trim() ? `Imagen seleccionada: ${name}` : "";
	}

	coverPick?.addEventListener("click", () => {
		coverInput?.click();
	});

	nameInput?.addEventListener("input", () => syncCard(card));

	iconSelect?.addEventListener("starwind-select:change", ((e: SelectChangeEvent) => {
		const value = e.detail?.value ?? "";
		showIconPreview(card, value);
		syncCard(card);
	}) as EventListener);

	coverInput?.addEventListener("change", () => {
		revokeCoverObjectUrl(card);
		const file = coverInput.files?.[0];
		if (file) {
			if (removeInput) removeInput.value = "";
			setCoverFilename(file.name);
		} else {
			setCoverFilename(null);
		}
		syncCard(card);
	});

	confirmRemove?.addEventListener("click", () => {
		if (coverInput) coverInput.value = "";
		if (removeInput) removeInput.value = "1";
		revokeCoverObjectUrl(card);
		setCoverFilename(null);
		syncCard(card);
	});

	undoRemove?.addEventListener("click", () => {
		if (removeInput) removeInput.value = "";
		revokeCoverObjectUrl(card);
		setCoverFilename(null);
		syncCard(card);
	});
}

export function initCategoryCards(): void {
	document.querySelectorAll<HTMLElement>("[data-category-card]").forEach(bindCard);
}

/** Syncs `[data-icon-preview]` when a Starwind Select with `data-field="icon"` changes. */
export function bindIconPreview(root: HTMLElement): void {
	if (root.dataset.iconPreviewBound === "1") return;
	root.dataset.iconPreviewBound = "1";

	const iconSelect = root.querySelector<HTMLElement>('[data-field="icon"]');
	iconSelect?.addEventListener("starwind-select:change", ((e: SelectChangeEvent) => {
		const iconId = e.detail?.value ?? "";
		const preview = root.querySelector<HTMLElement>("[data-icon-preview]");
		if (!preview) return;
		preview.querySelectorAll<HTMLElement>("[data-icon-id]").forEach((el) => {
			const match = el.dataset.iconId === iconId;
			el.classList.toggle("hidden", !match);
			el.classList.toggle("inline-flex", match);
		});
	}) as EventListener);
}

/** Bind suggestion chip buttons (`[data-suggest]`) to fill a target input. */
export function bindSuggestChips(
	inputSelector: string,
	root: ParentNode = document,
): void {
	const input = root.querySelector<HTMLInputElement>(inputSelector);
	if (!input) return;
	root.querySelectorAll<HTMLButtonElement>("[data-suggest]").forEach((btn) => {
		if (btn.dataset.bound === "1") return;
		btn.dataset.bound = "1";
		btn.addEventListener("click", () => {
			input.value = btn.dataset.suggest ?? "";
			input.focus();
		});
	});
}
