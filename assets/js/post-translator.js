// /assets/js/post-translator.js
import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0";

// ==== CONFIG ENV ====
env.allowRemoteModels = true; // boleh download model dari Hugging Face
env.allowLocalModels = false;
env.useBrowserCache = true; // simpan model di cache browser

let translatorPromise = null;
let modelLoaded = false;

function getIdEnTranslator() {
	if (!translatorPromise) {
		translatorPromise = pipeline("translation", "Xenova/opus-mt-id-en").then((t) => {
			modelLoaded = true;
			return t;
		});
	}
	return translatorPromise;
}

// ==== helper skip code / .no-translate ====
function isInSkipElement(node) {
	let current = node.parentNode;
	while (current && current !== document) {
		const tag = current.tagName;
		if (tag === "CODE" || tag === "PRE" || current.classList?.contains("no-translate")) {
			return true;
		}
		current = current.parentNode;
	}
	return false;
}

function getTextNodes(container) {
	const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
		acceptNode(node) {
			if (!node.nodeValue || !node.nodeValue.trim()) {
				return NodeFilter.FILTER_REJECT;
			}
			if (isInSkipElement(node)) {
				return NodeFilter.FILTER_REJECT;
			}
			return NodeFilter.FILTER_ACCEPT;
		},
	});
	const nodes = [];
	let current;
	while ((current = walker.nextNode())) {
		nodes.push(current);
	}
	return nodes;
}

async function translatePostContent() {
	const article = document.querySelector(".post-content");
	if (!article) return;

	const textNodes = getTextNodes(article);
	if (!textNodes.length) return;

	const translator = await getIdEnTranslator();

	for (const node of textNodes) {
		const original = node.nodeValue;
		try {
			const out = await translator(original);
			node.nodeValue = out[0].translation_text;
		} catch (e) {
			console.error("Gagal translate:", e);
		}
	}
}

// ==== modal UI ====
function setupTranslateUI() {
	const btnTranslate = document.getElementById("translate-post-btn");
	const modal = document.getElementById("translate-modal");
	const btnConfirm = document.getElementById("translate-modal-confirm");
	const btnCancel = document.getElementById("translate-modal-cancel");
	const statusElement = document.getElementById("translate-modal-status");

	const openModal = () => modal?.classList.remove("hidden");
	const closeModal = () => {
		if (!modal) return;
		modal.classList.add("hidden");
		if (statusElement) statusElement.textContent = "";
		if (btnConfirm) btnConfirm.disabled = false;
		if (btnCancel) btnCancel.disabled = false;
	};

	btnTranslate?.addEventListener("click", async () => {
		if (modelLoaded) {
			await translatePostContent();
			return;
		}
		openModal();
	});

	btnConfirm?.addEventListener("click", async () => {
		if (!statusElement) return;
		statusElement.textContent = "Mengunduh & memuat model (sekali saja)...";

		btnConfirm.disabled = true;
		btnCancel.disabled = true;

		try {
			await getIdEnTranslator(); // ini yang download + cache model
			statusElement.textContent = "Model siap. Menerjemahkan halaman...";
			await translatePostContent();
			closeModal();
		} catch (e) {
			console.error(e);
			statusElement.textContent = "Gagal mengunduh/memuat model. Cek koneksi lalu coba lagi.";
			btnConfirm.disabled = false;
			btnCancel.disabled = false;
		}
	});

	btnCancel?.addEventListener("click", () => {
		closeModal();
	});
}

document.addEventListener("DOMContentLoaded", setupTranslateUI);
