/**
 * Client-side QR preview + high-res PNG download for owner UI.
 * Targets `[data-menu-qr]` roots rendered by MenuQr.astro.
 */
import QRCode from "qrcode";

const DEFAULT_PREVIEW = 256;
const DEFAULT_DOWNLOAD = 1024;

function parseSize(value: string | undefined, fallback: number): number {
	const n = Number(value);
	return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

async function renderPreview(root: HTMLElement): Promise<void> {
	const url = root.dataset.url?.trim() ?? "";
	const canvas = root.querySelector<HTMLCanvasElement>("[data-qr-canvas]");
	const errorEl = root.querySelector<HTMLElement>("[data-qr-error]");
	const downloadBtn = root.querySelector<HTMLButtonElement>("[data-qr-download]");

	if (!canvas) return;

	if (!url) {
		if (errorEl) {
			errorEl.textContent = "URL no disponible.";
			errorEl.hidden = false;
		}
		if (downloadBtn) downloadBtn.disabled = true;
		return;
	}

	const size = parseSize(root.dataset.previewSize, DEFAULT_PREVIEW);

	try {
		await QRCode.toCanvas(canvas, url, {
			width: size,
			margin: 2,
			errorCorrectionLevel: "M",
			color: { dark: "#000000", light: "#ffffff" },
		});
		if (errorEl) errorEl.hidden = true;
		if (downloadBtn) downloadBtn.disabled = false;
	} catch (err) {
		if (errorEl) {
			errorEl.textContent =
				err instanceof Error ? err.message : "No se pudo generar el QR.";
			errorEl.hidden = false;
		}
		if (downloadBtn) downloadBtn.disabled = true;
	}
}

async function downloadHighRes(root: HTMLElement): Promise<void> {
	const url = root.dataset.url?.trim() ?? "";
	if (!url) return;

	const filename = root.dataset.filename?.trim() || "menu-qr.png";
	const size = parseSize(root.dataset.downloadSize, DEFAULT_DOWNLOAD);
	const downloadBtn = root.querySelector<HTMLButtonElement>("[data-qr-download]");
	const errorEl = root.querySelector<HTMLElement>("[data-qr-error]");

	if (downloadBtn) downloadBtn.disabled = true;

	try {
		const dataUrl = await QRCode.toDataURL(url, {
			width: size,
			margin: 2,
			errorCorrectionLevel: "M",
			color: { dark: "#000000", light: "#ffffff" },
		});
		const a = document.createElement("a");
		a.href = dataUrl;
		a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
		a.rel = "noopener";
		document.body.appendChild(a);
		a.click();
		a.remove();
		if (errorEl) errorEl.hidden = true;
	} catch (err) {
		if (errorEl) {
			errorEl.textContent =
				err instanceof Error ? err.message : "No se pudo descargar el QR.";
			errorEl.hidden = false;
		}
	} finally {
		if (downloadBtn) downloadBtn.disabled = false;
	}
}

function bindOne(root: HTMLElement): void {
	void renderPreview(root);

	if (root.dataset.qrBound === "1") return;
	root.dataset.qrBound = "1";

	const downloadBtn = root.querySelector<HTMLButtonElement>("[data-qr-download]");
	downloadBtn?.addEventListener("click", () => {
		void downloadHighRes(root);
	});
}

/** Bind all `[data-menu-qr]` roots under `scope` (or document). */
export function bindMenuQr(scope: ParentNode = document): void {
	scope.querySelectorAll<HTMLElement>("[data-menu-qr]").forEach(bindOne);
}
