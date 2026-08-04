/**
 * LATIHAN CORE JS (RESET FIXED VERSION)
 * Fitur:
 * 1. Reset Logic Fixed (Menggunakan skipSave)
 * 2. Auto Theme (Cyber/Monokai)
 * 3. Recycle Iframe & Custom Modal
 */

var editor;
let virtualFiles = [];
let activeFileIndex = 0;
let currentLang = "python";

let isSyncing = false;

let detachedWindow = null;
let detachWatcher = null;
let isDetachedMode = false;

const pistonLangMap = {
	python: "python",
	c_cpp: "cpp",
	c: "c",
	go: "go",
	java: "java",
	javascript: "javascript",
	rust: "rust",
	php: "php",
	sh: "bash",
};

const MODEL_LIST = {
	gemini: [
		{ id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
		{ id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
	],
	openai: [
		{ id: "gpt-4o-mini", name: "GPT-4o Mini" },
		{ id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
	],
	deepseek: [{ id: "deepseek-chat", name: "DeepSeek V3" }],
};

// --- 1. EDITOR INITIALIZATION ---
function initEditor(lang) {
	currentLang = lang;
	ace.config.set("basePath", "https://cdnjs.cloudflare.com/ajax/libs/ace/1.32.7/");
	editor = ace.edit("editor");

	editor.setFontSize(14);
	editor.session.setUseWrapMode(true);
	editor.setOptions({
		enableBasicAutocompletion: true,
		enableSnippets: true,
		enableLiveAutocompletion: true,
		showPrintMargin: false,
		cursorStyle: "smooth",
	});

	injectCyberStyles();
	updateEditorTheme();

	const observer = new MutationObserver(function (mutations) {
		mutations.forEach(function (mutation) {
			if (mutation.attributeName === "class") updateEditorTheme();
		});
	});
	observer.observe(document.documentElement, { attributes: true });

	// [FIX] Event Listener dengan Pengecekan Flag
	editor.session.on("change", function () {
		// Jika sedang syncing dari anak, JANGAN kirim balik ke anak (cegah loop/kursor loncat)
		if (isSyncing) return;

		if (virtualFiles[activeFileIndex]) {
			virtualFiles[activeFileIndex].content = editor.getValue();

			// Kirim ke anak jika aktif
			if (detachedWindow && !detachedWindow.closed && detachedWindow.updateChildEditor) {
				detachedWindow.updateChildEditor(virtualFiles[activeFileIndex].name, editor.getValue());
			}
		}
	});

	loadVirtualFiles();
	loadSettings();
}

// Pastikan ini ada di JS Anda agar background Ace Editor menyatu mulus

// Pastikan ini ada di JS Anda agar background Ace Editor menyatu mulus
function injectCyberStyles() {
	const style = document.createElement("style");
	style.innerHTML = `
        /* DARK MODE: Paksa background Monokai jadi Hitam Pekat */
        .ace-monokai { background-color: #020617 !important; color: #f8f8f2 !important; }
        .ace-monokai .ace_gutter { background-color: #050505 !important; color: #64748b !important; border-right: 1px solid #1e293b !important; }

        /* LIGHT MODE: Chrome Theme bersih */
        .ace-chrome { background-color: #ffffff !important; }

        /* SCROLLBAR CUSTOM (Opsional biar makin Cyber) */
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
    `;
	document.head.appendChild(style);
}

function updateEditorTheme() {
	const isDarkMode = document.documentElement.classList.contains("dark");
	editor.setTheme(isDarkMode ? "ace/theme/monokai" : "ace/theme/chrome");
}

// --- 2. FILE SYSTEM (RESET FIX) ---
function loadVirtualFiles() {
	const rawFiles = document.getElementById("files-data") || document.getElementById("vault-files");
	if (!rawFiles) return;

	try {
		let content = rawFiles.value;
		// Parsing aman untuk karakter HTML entities
		if (content.includes("&quot;") || content.includes("&lt;")) {
			content = new DOMParser().parseFromString(content, "text/html").documentElement.textContent;
		}
		virtualFiles = JSON.parse(content);
		if (!Array.isArray(virtualFiles)) throw new Error("Format data salah");
	} catch (e) {
		console.error("Failed load files:", e);
		virtualFiles = [{ name: "error.txt", content: "Gagal memuat file. Refresh halaman." }];
	}

	renderFileList();

	// PERBAIKAN PENTING:
	// Tambahkan 'true' (skipSave) agar kode kotor di editor TIDAK menimpa kode bersih yang baru diload.
	openFile(0, true);
}

// ==========================================
// RENDER FILE LIST (FOLDER SUPPORT)
// ==========================================
// ==========================================
// RENDER FILE LIST (CUSTOM SVG FOLDER)
// ==========================================
function renderFileList() {
	const container = document.getElementById("file-list");
	if (!container) return;
	container.innerHTML = "";

	// DEFINISI ICON SVG (Warna Kuning Folder)
	const iconClosed = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-folder2 text-yellow-500" viewBox="0 0 16 16"><path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5zM2.5 3a.5.5 0 0 0-.5.5V6h12v-.5a.5.5 0 0 0-.5-.5H9c-.964 0-1.71-.629-2.174-1.154C6.374 3.334 5.82 3 5.264 3zM14 7H2v5.5a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5z"/></svg>`;

	const iconOpen = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-folder2-open text-yellow-500" viewBox="0 0 16 16"><path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0 1 15 5.5v.64c.57.265.94.876.856 1.546l-.64 5.124A2.5 2.5 0 0 1 12.733 15H3.266a2.5 2.5 0 0 1-2.481-2.19l-.64-5.124A1.5 1.5 0 0 1 1 6.14zM2 6h12v-.5a.5.5 0 0 0-.5-.5H9c-.964 0-1.71-.629-2.174-1.154C6.374 3.334 5.82 3 5.264 3H2.5a.5.5 0 0 0-.5.5zm-.367 1a.5.5 0 0 0-.496.562l.64 5.124A1.5 1.5 0 0 0 3.266 14h9.468a1.5 1.5 0 0 0 1.489-1.314l.64-5.124A.5.5 0 0 0 14.367 7z"/></svg>`;

	// 1. Build Tree Logic
	const fileTree = {};
	virtualFiles.forEach((file, index) => {
		const parts = file.name.split("/");
		let currentLevel = fileTree;
		parts.forEach((part, i) => {
			if (i === parts.length - 1) {
				currentLevel[part] = { type: "file", index: index, name: file.name, displayName: part };
			} else {
				if (!currentLevel[part]) currentLevel[part] = { type: "folder", children: {} };
				currentLevel = currentLevel[part].children;
			}
		});
	});

	// 2. Build HTML Logic
	function buildTreeHTML(tree, level = 0) {
		let html = "";
		const keys = Object.keys(tree).sort((a, b) => {
			const typeA = tree[a].type;
			const typeB = tree[b].type;
			if (typeA === typeB) return a.localeCompare(b);
			return typeA === "folder" ? -1 : 1;
		});

		keys.forEach((key) => {
			const item = tree[key];
			const padding = level * 15 + 10;

			if (item.type === "folder") {
				html += `
                <div class="folder-group">
                    <div class="folder-header" style="padding-left:${padding}px; cursor:pointer; color:#94a3b8; font-size:12px; font-weight:bold; padding-top:5px; padding-bottom:5px; display:flex; align-items:center; gap:6px;"
                         onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.icon-closed').classList.toggle('hidden'); this.querySelector('.icon-open').classList.toggle('hidden');">

                        <span class="icon-closed">${iconClosed}</span>
                        <span class="icon-open hidden">${iconOpen}</span>
                        <span style="margin-top:1px;">${key}</span>
                    </div>
                    <div class="folder-content">
                        ${buildTreeHTML(item.children, level + 1)}
                    </div>
                </div>`;
			} else {
				// File Icons
				let iconClass = "devicon-vscode-plain text-slate-400";
				if (item.name.endsWith(".html")) iconClass = "devicon-html5-plain text-orange-600 dark:text-orange-500";
				else if (item.name.endsWith(".css")) iconClass = "devicon-css3-plain text-blue-600 dark:text-blue-500";
				else if (item.name.endsWith(".js")) iconClass = "devicon-javascript-plain text-yellow-500 dark:text-yellow-400";

				const isActive = item.index === activeFileIndex;
				let activeClass = isActive
					? "bg-slate-100 dark:bg-[#151b2e] border-blue-500 font-bold text-blue-600 dark:text-blue-400"
					: "border-transparent hover:bg-slate-50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400";

				html += `
                <div onclick="openFile(${item.index})" class="cursor-pointer py-1.5 text-xs font-mono truncate flex items-center gap-2 border-l-2 ${activeClass}" style="padding-left:${padding}px;">
                    <i class="${iconClass} text-sm"></i> <span>${item.displayName}</span>
                </div>`;
			}
		});
		return html;
	}

	container.innerHTML = buildTreeHTML(fileTree);

	// Update Label
	const label = document.getElementById("active-filename");
	if (label && virtualFiles[activeFileIndex]) label.innerText = virtualFiles[activeFileIndex].name;
}

// PERBAIKAN PENTING DI SINI:
function openFile(index, skipSave = false) {
	// Hanya simpan file sebelumnya JIKA bukan sedang Reset/Init
	if (!skipSave) {
		saveCurrentFile();
	}

	activeFileIndex = index;
	const file = virtualFiles[index];

	// Set value -1 agar cursor pindah ke awal dan bersih
	// Cek dulu agar kursor tidak loncat jika kontennya sama (penting untuk sync)
	if (editor.getValue() !== file.content) {
		editor.setValue(file.content, -1);
	}

	const label = document.getElementById("active-filename");
	if (label) label.innerText = file.name;

	let mode = currentLang;
	if (file.name.endsWith(".html")) mode = "html";
	else if (file.name.endsWith(".css")) mode = "css";
	else if (file.name.endsWith(".js")) mode = "javascript";
	else if (file.name.endsWith(".sh")) mode = "sh";
	else if (file.name.endsWith(".py")) mode = "python";

	editor.session.setMode("ace/mode/" + (mode === "c_cpp" ? "c_cpp" : mode));
	renderFileList();

	// [LOGIKA TAMBAHAN] Perintahkan Window Anak untuk buka file yang sama
	if (detachedWindow && !detachedWindow.closed && detachedWindow.openChildFile) {
		detachedWindow.openChildFile(index);
	}
}

function saveCurrentFile() {
	if (virtualFiles[activeFileIndex]) {
		virtualFiles[activeFileIndex].content = editor.getValue();
	}
}

// ==========================================
// 1. SISTEM VIRTUAL DEBUGGING (CONSOLE UI)
// ==========================================

// Fungsi dipanggil oleh Iframe untuk lapor log
// ==========================================
// 4. VIRTUAL DEBUGGING (ALL NEW ICONS)
// ==========================================
window.virtualLog = function (type, messages) {
	const consoleDiv = document.getElementById("virtual-console");
	if (consoleDiv) {
		const row = document.createElement("div");
		row.className = "border-b border-white/5 pb-1 flex gap-2 break-all items-start";

		// --- DEFINISI ICON SVG ---
		const iInfo = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-info-circle" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/><path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0"/></svg>`;

		const iWarn = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-exclamation-triangle" viewBox="0 0 16 16"><path d="M7.938 2.016A.13.13 0 0 1 8.002 2a.13.13 0 0 1 .063.016.15.15 0 0 1 .054.057l6.857 11.667c.036.06.035.124.002.183a.2.2 0 0 1-.054.06.1.1 0 0 1-.066.017H1.146a.1.1 0 0 1-.066-.017.2.2 0 0 1-.054-.06.18.18 0 0 1 .002-.183L7.884 2.073a.15.15 0 0 1 .054-.057m1.044-.45a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767z"/><path d="M7.002 12a1 1 0 1 1 2 0 1 1 0 0 1-2 0M7.1 5.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0z"/></svg>`;

		const iSuccess = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check-circle" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/><path d="m10.97 4.97-.02.022-3.473 4.425-2.093-2.094a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-1.071-1.05"/></svg>`;

		const iError = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x-circle" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708"/></svg>`;

		let icon = iInfo; // Default
		let colorClass = "text-slate-300";

		if (type === "error") {
			icon = iError;
			colorClass = "text-red-500";
		} else if (type === "warn") {
			icon = iWarn;
			colorClass = "text-yellow-400";
		} else if (type === "success") {
			icon = iSuccess;
			colorClass = "text-green-400";
		}

		const text = messages
			.map((msg) => {
				if (typeof msg === "object") return JSON.stringify(msg);
				return String(msg);
			})
			.join(" ");

		row.innerHTML = `<span class="opacity-80 select-none mt-0.5 ${colorClass}">${icon}</span> <span class="${colorClass}">${text}</span>`;
		consoleDiv.appendChild(row);
		consoleDiv.scrollTop = consoleDiv.scrollHeight;
	}

	if (detachedWindow && !detachedWindow.closed && detachedWindow.logToChild) {
		detachedWindow.logToChild(type, messages.join(" "));
	}
};

function clearConsole() {
	const consoleDiv = document.getElementById("virtual-console");
	if (consoleDiv) consoleDiv.innerHTML = '<div class="text-slate-500 italic">> Console cleared.</div>';
}

// ==========================================
// 2. SISTEM VIRTUAL ROUTER
// ==========================================

// Fungsi dipanggil saat Iframe minta pindah halaman
// --- VIRTUAL ROUTER SYSTEM ---
// ==========================================
// 1. SISTEM VIRTUAL ROUTER (Global Helper)
// ==========================================

// ==========================================
// 2. RUNNER ENGINE (REALISTIC LOADER)
// ==========================================
// ==========================================
// 1. SISTEM VIRTUAL ROUTER
// ==========================================
// ==========================================
// ==========================================
// 1. GLOBAL VIRTUAL ROUTER
// ==========================================
// ==========================================
// 1. GLOBAL VIRTUAL ROUTER
// ==========================================
window.handleVirtualNavigation = function (targetFilename) {
	if (!targetFilename) return;

	// Bersihkan path
	let cleanName = String(targetFilename).trim();
	if (cleanName.startsWith("./")) cleanName = cleanName.substring(2);
	if (cleanName.startsWith("/")) cleanName = cleanName.substring(1);

	console.log(`[Router] Navigating to: ${cleanName}`);
	runWeb(cleanName);
};
// ==========================================
// 2. RUNNER ENGINE (THEME READY)
// ==========================================
function runWeb(entryPoint = "index.html") {
	// A. Housekeeping
	if (entryPoint === "index.html") {
		saveCurrentFile();
		clearConsole();
	}

	// B. Ambil Konten File
	let activeHtmlFile = virtualFiles.find((f) => f.name.trim().toLowerCase() === entryPoint.trim().toLowerCase());
	let htmlContent = "";

	if (!activeHtmlFile) {
		// Tampilan 404
		htmlContent = `<div style="text-align:center; padding:50px; font-family:sans-serif; color:#ef4444;">
            <h2>404 Not Found</h2>
            <p>File <strong>${entryPoint}</strong> tidak ditemukan.</p>
            <button onclick="window.parent.handleVirtualNavigation('index.html')" style="padding:8px 16px; cursor:pointer;">Home</button>
        </div>`;
	} else {
		htmlContent = activeHtmlFile.content;
	}

	if (!htmlContent.toLowerCase().includes("<body")) htmlContent = `<body>${htmlContent}</body>`;

	// ===============================================
	// C. SYSTEM SCRIPT (PENTING UNTUK FULL SCREEN)
	// ===============================================
	// Kita gunakan Event Delegation di sini KHUSUS untuk Full Screen
	// karena kita tidak bisa memanipulasi DOM Full Screen secara langsung dari sini.
	const systemScript = `
    <script>
        (function(){
            var sl = function(t,a){ if(window.parent && window.parent.virtualLog) window.parent.virtualLog(t, Array.from(a)); };
            window.onerror = function(m){ sl('error', ["Runtime: "+m]); return true; };
            console.log = function(){ sl('log', arguments); };

            // Alert Override
            var style = document.createElement('style');
            style.innerHTML = ".v-box{background:white;padding:20px;border-radius:8px;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99999;box-shadow:0 10px 30px rgba(0,0,0,0.3);font-family:sans-serif;border:1px solid #ccc;min-width:200px;text-align:center} .v-btn{margin-top:15px;padding:6px 15px;background:#2563eb;color:white;border:none;border-radius:4px;cursor:pointer}";
            document.head.appendChild(style);
            window.alert = function(m){
                var d=document.createElement('div'); d.className='v-box';
                d.innerHTML='<p>'+m+'</p><button class="v-btn" onclick="this.parentNode.remove()">OK</button>';
                document.body.appendChild(d);
                sl('system', ["[Alert] "+m]);
            };

            // LINK KILLER (Khusus Full Screen & Backup)
            document.addEventListener('click', function(e) {
                var target = e.target.closest('a');
                if (target) {
                    var href = target.getAttribute('href');
                    if (href && !href.match(/^http/) && !href.startsWith('#') && !href.startsWith('mailto:')) {
                        e.preventDefault();
                        if(window.parent.handleVirtualNavigation) {
                            window.parent.handleVirtualNavigation(href);
                        }
                    }
                }
            });
        })();
    <\/script>`;

	// ===============================================
	// D. INJECT ASSETS (CARA AMAN - TANPA TEMPLATE LITERAL JS)
	// ===============================================
	let css = virtualFiles.find((f) => f.name === "style.css")?.content || "";
	let js = virtualFiles.find((f) => f.name === "script.js")?.content || "";

	// 1. Inject System Script
	htmlContent = systemScript + htmlContent;

	// 2. Inject CSS
	if (htmlContent.match(/<link[^>]+href=["']style\.css["'][^>]*>/gi)) {
		htmlContent = htmlContent.replace(/<link[^>]+href=["']style\.css["'][^>]*>/gi, `<style>${css}</style>`);
	}

	// 3. Inject JS (Manual Replace agar tidak Syntax Error)
	if (htmlContent.match(/<script[^>]+src=["']script\.js["'][^>]*>[\s\S]*?<\/script>/gi)) {
		// Kita tidak membungkus dengan try-catch string literal yang rentan error
		// Kita ganti langsung dengan tag script biasa
		htmlContent = htmlContent.replace(
			/<script[^>]+src=["']script\.js["'][^>]*>[\s\S]*?<\/script>/gi,
			`<script>
                document.addEventListener('DOMContentLoaded', function() {
                    // User Code Start
                    ${js}
                    // User Code End
                });
            <\/script>`
		);
	}

	// ===============================================
	// E. RENDER TARGET
	// ===============================================

	// 1. Render ke Window Full Screen (Jika Aktif)
	if (detachedWindow && !detachedWindow.closed && detachedWindow.updatePreview) {
		detachedWindow.updatePreview(htmlContent);
	}

	// 2. Render ke Window Utama (Iframe Lokal)
	let oldFrame = document.getElementById("preview-frame");
	if (oldFrame) {
		let newFrame = document.createElement("iframe");
		newFrame.id = "preview-frame";
		newFrame.className = oldFrame.className;
		if (oldFrame.style.cssText) newFrame.style.cssText = oldFrame.style.cssText;
		if (oldFrame.getAttribute("sandbox")) newFrame.setAttribute("sandbox", oldFrame.getAttribute("sandbox"));

		oldFrame.parentNode.replaceChild(newFrame, oldFrame);

		const doc = newFrame.contentDocument || newFrame.contentWindow.document;
		doc.open();
		doc.write(htmlContent);
		doc.close();

		// [MANUAL DOM MANIPULATION - PERBAIKAN ERROR REFERENCE]
		// Ini dijalankan SETELAH render, khusus untuk window utama agar navigasi mulus (tidak blank)
		const links = doc.querySelectorAll("a");
		links.forEach((anchor) => {
			const rawHref = anchor.getAttribute("href");
			if (rawHref && !rawHref.match(/^http|^https|^\/\//) && !rawHref.startsWith("#") && !rawHref.startsWith("mailto:")) {
				anchor.removeAttribute("href"); // Matikan link fisik
				anchor.style.cursor = "pointer";
				anchor.style.textDecoration = "underline";
				anchor.style.color = "blue";

				// [FIX ERROR DISINI: Tambahkan window.handleVirtualNavigation]
				anchor.onclick = function (e) {
					e.preventDefault();
					console.log(`[Main Window] Clicked: ${rawHref}`);

					if (typeof window.handleVirtualNavigation === "function") {
						window.handleVirtualNavigation(rawHref);
					} else {
						console.error("Fungsi handleVirtualNavigation tidak ditemukan!");
					}
				};
			}
		});

		// Update UI
		const urlBar = document.getElementById("browser-url");
		if (urlBar) urlBar.innerText = `localhost:8080/${entryPoint}`;

		setTimeout(() => {
			const titleTab = document.getElementById("browser-title");
			if (titleTab) titleTab.innerText = doc.title || entryPoint;
		}, 50);
	}

	if (entryPoint === "index.html") setTimeout(() => runValidation(htmlContent), 100);
}

// --- 4. RUNNER PISTON ---
async function runPiston() {
	saveCurrentFile();
	const consoleOut = document.getElementById("console-output");
	consoleOut.innerHTML = "<span class='animate-pulse text-blue-500'>🚀 Executing...</span>";

	const pistonLang = pistonLangMap[currentLang] || "bash";

	try {
		const filesPayload = virtualFiles.map((f) => ({ name: f.name, content: f.content }));
		const response = await fetch("https://emkc.org/api/v2/piston/execute", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ language: pistonLang, version: "*", files: filesPayload }),
		});
		const data = await response.json();

		let output = "";
		if (data.run) {
			output = data.run.stdout + (data.run.stderr ? `\n[STDERR]\n${data.run.stderr}` : "");
			if (!output) output = "No output.";

			const wsType = document.getElementById("workspace-type");
			if (wsType && wsType.value === "terminal") {
				const cleanOut = output.replace(/\n/g, "<br/>");
				consoleOut.innerHTML = `root@kali:~# ./script.sh<br/>${cleanOut}<br/><span class='animate-pulse font-bold'>root@kali:~# _</span>`;
			} else {
				consoleOut.innerText = output;
			}
		} else {
			consoleOut.innerText = "Error API: " + JSON.stringify(data);
		}
		runValidation(output);
	} catch (err) {
		consoleOut.innerText = "Network Error: " + err.message;
	}
}

// --- 5. VALIDATION ---
// Variable Global untuk mencegah spam selebrasi
let hasCelebrated = false;

// --- 5. VALIDATION SYSTEM (WITH CELEBRATION) ---
function runValidation(inputData) {
	const elValidation = document.getElementById("validation-logic") || document.getElementById("vault-logic");
	let rawLogic = elValidation ? elValidation.value : "";
	if (!rawLogic) return;

	try {
		const logic = new DOMParser().parseFromString(rawLogic, "text/html").documentElement.textContent;
		const checkFunc = new Function("data", "code", "files", logic);
		const results = checkFunc(inputData, editor.getValue(), virtualFiles);

		// Hitung status checklist
		let allPassed = true;

		results.forEach((passed, index) => {
			if (!passed) allPassed = false; // Jika ada satu saja yang salah, batal menang

			const li = document.getElementById(`task-${index}`);
			if (li) {
				const iconPending = li.querySelector(".icon-pending");
				const iconSuccess = li.querySelector(".icon-success");

				if (passed) {
					li.classList.remove("border-slate-200", "dark:border-slate-700", "bg-slate-50", "dark:bg-[#252526]");
					li.classList.add("border-green-500/50", "bg-green-500/10");
					if (iconPending) iconPending.classList.add("hidden");
					if (iconSuccess) iconSuccess.classList.remove("hidden");
				} else {
					li.classList.add("border-slate-200", "dark:border-slate-700", "bg-slate-50", "dark:bg-[#252526]");
					li.classList.remove("border-green-500/50", "bg-green-500/10");
					if (iconPending) iconPending.classList.remove("hidden");
					if (iconSuccess) iconSuccess.classList.add("hidden");
				}
			}
		});

		// LOGIKA SELEBRASI
		// Jika semua benar DAN belum pernah dirayakan sebelumnya
		if (allPassed && !hasCelebrated) {
			hasCelebrated = true; // Tandai sudah dirayakan agar tidak muncul terus saat diklik Run
			triggerCelebration();
		}
		// Jika user merusak kodenya lagi, reset status agar bisa dirayakan lagi nanti
		else if (!allPassed) {
			hasCelebrated = false;
		}
	} catch (e) {
		console.error("Validation error:", e);
	}
}

// ... (kode validasi sebelumnya) ...

// --- FUNGSI BARU: EFEK KEMBANG API, AUDIO & MODAL ---

// 1. PRELOAD AUDIO (Taruh di luar fungsi agar tidak delay saat download)
const winSound = new Audio("/assets/audio/winner.wav");
winSound.volume = 0.5; // Set volume di awal

function triggerCelebration() {
	// 2. PUTAR AUDIO DULUAN (Instant karena sudah di-preload)
	try {
		winSound.currentTime = 0; // Reset ke detik 0 (kalau diputar berulang)
		winSound.play().catch((e) => console.warn("Audio blocked:", e));
	} catch (e) {
		console.log("Audio error");
	}

	// 3. DELAY PARTIKEL (0.5 Detik setelah suara)
	setTimeout(() => {
		// Loop animasi confetti
		var duration = 3000;
		var end = Date.now() + duration;

		(function frame() {
			// Sisi Kiri
			confetti({
				particleCount: 5,
				angle: 60,
				spread: 55,
				origin: { x: 0 },
				colors: ["#22c55e", "#3b82f6", "#f472b6"],
			});
			// Sisi Kanan
			confetti({
				particleCount: 5,
				angle: 120,
				spread: 55,
				origin: { x: 1 },
				colors: ["#22c55e", "#3b82f6", "#f472b6"],
			});

			if (Date.now() < end) {
				requestAnimationFrame(frame);
			}
		})();
	}, 500); // <--- Delay 500ms (0.5 detik) sesuai request

	// 4. TAMPILKAN MODAL (Delay 1.5 detik biar user menikmati kembang api dulu)
	setTimeout(() => {
		showSystemModal("🎉 Misi Selesai! Kode anda berjalan dengan sempurna.", "alert");
	}, 1500);
}

// ... (sisa kode fungsi showSystemModal, saveSettings, dll di bawahnya tetap sama) ...

// --- 6. AI MENTOR ---
async function askAIMentor() {
	const key = localStorage.getItem("cyber_ai_key");
	const provider = localStorage.getItem("cyber_ai_provider");
	let selectedModel = localStorage.getItem("cyber_ai_model") || (provider === "gemini" ? "gemini-2.5-flash" : "gpt-3.5-turbo");

	if (!key) {
		toggleSettings();
		return;
	}

	const statusText = document.getElementById("ai-status-text");
	const responseArea = document.getElementById("ai-response-area");

	if (statusText) {
		statusText.style.display = "none";
		statusText.classList.add("hidden");
	}
	if (responseArea) {
		responseArea.style.display = "block";
		responseArea.classList.remove("hidden");
		responseArea.innerHTML = `<div class="flex items-center gap-3 py-2 text-slate-500 dark:text-slate-400 animate-pulse"><div class="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div><span class="text-xs font-mono">AI sedang membaca kodemu...</span></div>`;
	}

	const rawMission = document.getElementById("mission-data") || document.getElementById("vault-mission");
	let data = {};
	try {
		const decoded = new DOMParser().parseFromString(rawMission.value, "text/html").documentElement.textContent;
		data = JSON.parse(decoded);
	} catch (e) {
		console.log(e);
	}

	let checklistStr = (data.checklist || []).map((i) => `- ${i}`).join("\n");
	saveCurrentFile();
	let codeStr = "";
	virtualFiles.forEach((f) => {
		codeStr += `\n--- ${f.name} ---\n${f.content}\n`;
	});

	const prompt = `
    ROLE: Validator Kode Otomatis (Singkat & Tegas).
    MISI: "${data.title}"
    CHECKLIST TARGET:
    ${checklistStr}
    KODE USER SAAT INI:
    ${codeStr}
    ATURAN JAWABAN (WAJIB PATUH):
    1. JANGAN PERNAH menulis ulang kode user secara lengkap. SAYA LARANG KERAS.
    2. Fokus HANYA pada checklist yang BELUM terpenuhi (Status Salah).
    3. Jika kode salah, berikan HINT atau PETUNJUK LOGIKA saja dalam 1-2 kalimat.
    4. Jawab sesingkat mungkin. Maksimal 50 kata.
    `;

	try {
		let resultText = "";
		let url = provider === "gemini" ? `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${key}` : "https://api.openai.com/v1/chat/completions";
		let body = provider === "gemini" ? { contents: [{ parts: [{ text: prompt }] }] } : { model: selectedModel, messages: [{ role: "user", content: prompt }] };

		const resp = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json", ...(provider !== "gemini" && { Authorization: `Bearer ${key}` }) },
			body: JSON.stringify(body),
		});
		const json = await resp.json();

		if (provider === "gemini") {
			if (json.candidates) resultText = json.candidates[0].content.parts[0].text;
			else throw new Error("No response from Gemini");
		} else {
			if (json.choices) resultText = json.choices[0].message.content;
			else throw new Error("No response from OpenAI");
		}
		responseArea.innerHTML = marked.parse(resultText);
	} catch (e) {
		responseArea.innerHTML = `<span class="text-red-500 text-xs">Error: ${e.message}</span>`;
	}
}

// --- 7. UTILS & MODAL SYSTEM (THEME AWARE) ---

// ==========================================
// UTILS & MODAL SYSTEM (UPDATED: Support Cancel Callback)
// ==========================================
function showSystemModal(message, type = "alert", onConfirm = null, onCancel = null) {
	const isDark = document.documentElement.classList.contains("dark");
	const bg = isDark ? "#1e293b" : "#ffffff";
	const txt = isDark ? "#cbd5e1" : "#6b7280";

	const div = document.createElement("div");
	div.style.cssText = `position:fixed; top:0; left:0; width:100%; height:100%; background: rgba(0,0,0,0.6); z-index: 99999; backdrop-filter: blur(4px); display:flex; justify-content:center; align-items:center; animation: fadeIn 0.2s forwards;`;

	// Ikon berdasarkan tipe
	let icon = "";
	let btnColor = "";
	let title = "";

	if (type === "confirm") {
		icon = `<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 mb-4"><svg class="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" /></svg></div>`;
		btnColor = "bg-blue-600 hover:bg-blue-500";
		title = "Konfirmasi";
	} else if (type === "skip_tour") {
		// Icon Khusus Skip Tour (Door/Exit)
		icon = `<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900 mb-4"><svg class="h-6 w-6 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg></div>`;
		btnColor = "bg-yellow-600 hover:bg-yellow-500 text-white";
		title = "Skip Tour?";
	} else {
		icon = `<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900 mb-4"><svg class="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg></div>`;
		btnColor = "bg-green-600 hover:bg-green-500";
		title = "Sukses";
	}

	div.innerHTML = `
        <div style="background:${bg}; color:${txt}; padding:24px; border-radius:16px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); width:90%; max-width:400px; text-align:center; transform: scale(0.95); animation: popIn 0.2s forwards; border: 1px solid rgba(255,255,255,0.1);">
            ${icon}
            <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-2 font-mono tracking-tight">${title}</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">${message}</p>
            <div class="flex gap-3 justify-center">
                ${
									type === "confirm" || type === "skip_tour"
										? `<button id="m-cancel" class="flex-1 px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Batal</button>`
										: ""
								}
                <button id="m-ok" class="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold text-white shadow-lg transition-all active:scale-95 ${btnColor}">${
		type === "skip_tour" ? "Ya, Skip" : "OK"
	}</button>
            </div>
        </div>`;

	document.body.appendChild(div);

	// Handle OK
	div.querySelector("#m-ok").onclick = () => {
		div.remove();
		if (onConfirm) onConfirm();
	};

	// Handle Cancel
	if (type === "confirm" || type === "skip_tour") {
		div.querySelector("#m-cancel").onclick = () => {
			div.remove();
			if (onCancel) onCancel();
		};
	}
}

function saveSettings() {
	localStorage.setItem("cyber_ai_provider", document.getElementById("ai-provider").value);
	localStorage.setItem("cyber_ai_model", document.getElementById("ai-model").value);
	localStorage.setItem("cyber_ai_key", document.getElementById("api-key-input").value);
	toggleSettings();
	showSystemModal("Konfigurasi AI berhasil disimpan!", "alert");
}

function resetCode() {
	showSystemModal("Apakah anda yakin ingin mereset kode ke awal? Perubahan anda akan hilang.", "confirm", function () {
		loadVirtualFiles();
	});
}

function loadSettings() {
	if (localStorage.getItem("cyber_ai_key")) {
		const providerElem = document.getElementById("ai-provider");
		if (providerElem) providerElem.value = localStorage.getItem("cyber_ai_provider") || "gemini";
		document.getElementById("api-key-input").value = localStorage.getItem("cyber_ai_key");
		updateModelOptions();
		if (localStorage.getItem("cyber_ai_model")) document.getElementById("ai-model").value = localStorage.getItem("cyber_ai_model");
	} else {
		updateModelOptions();
	}
}
function updateModelOptions() {
	const provider = document.getElementById("ai-provider").value;
	const modelSelect = document.getElementById("ai-model");
	const models = MODEL_LIST[provider] || [];
	modelSelect.innerHTML = "";
	models.forEach((m) => {
		const option = document.createElement("option");
		option.value = m.id;
		option.text = m.name;
		modelSelect.appendChild(option);
	});
}
function toggleSettings() {
	document.getElementById("settings-modal").classList.toggle("hidden");
}

// --- 8. SYSTEM TOUR GUIDE (AUTO ONE-TIME) ---
// --- 8. SYSTEM TOUR GUIDE (FIXED SCROLL & THEME) ---

// --- 8. SYSTEM TOUR GUIDE (FIXED POSITIONING) ---

// --- 8. SYSTEM TOUR GUIDE (AUTO ONE-TIME) ---

// ==========================================
// 8. SYSTEM TOUR GUIDE (SMART SKIP UI)
// ==========================================
// ==========================================
// 8. SYSTEM TOUR GUIDE (SMART RESUME & CLEAN UI)
// ==========================================
// ==========================================
// 8. SYSTEM TOUR GUIDE (STABLE RESUME VERSION)
// ==========================================
// ==========================================
// 8. SYSTEM TOUR GUIDE (STABLE RESUME VERSION)
// ==========================================
// ==========================================
// 8. SYSTEM TOUR GUIDE (FIXED RESUME LOGIC)
// ==========================================
function initCyberTour() {
	// 1. Cek apakah user sudah pernah menyelesaikan tour
	if (localStorage.getItem("cyber_tour_finished")) return;

	const driver = window.driver.js.driver;

	// Variabel pelacak index yang lebih aman
	let activeIndex = 0;

	// 2. Definisi Langkah (Wajib dipisah agar bisa dilacak)
	const tourSteps = [
		{ element: "#mission-instruction", popover: { title: "📄 Misi & Instruksi", description: "Baca deskripsi misi dan teori di sini sebelum mulai ngoding.", side: "right", align: "start" } },
		{ element: "#code-editor", popover: { title: "💻 Code Editor", description: "Tulis kode HTML, CSS, atau JS Anda di sini.", side: "right", align: "start" } },
		{ element: "#btn-run-code", popover: { title: "▶️ Run Preview", description: "Klik ini setiap kali mengubah kode untuk melihat hasilnya.", side: "bottom" } },
		{ element: "#preview-frame-container", popover: { title: "🌐 Browser Result", description: "Hasil codingan Anda akan muncul di sini.", side: "left", align: "start" } },
		{ element: "#objective-list", popover: { title: "✅ Objective Checklist", description: "Target yang harus dicapai. Centang akan hijau jika benar.", side: "left", align: "start" } },
		{ element: "#btn-ai-config", popover: { title: "⚙️ AI Configuration", description: "Setting API Key di sini untuk fitur cerdas.", side: "bottom" } },
		{ element: "#ai-container", popover: { title: "🤖 AI Mentor", description: "Mentok? Klik Analyze. AI akan memberi petunjuk.", side: "left" } },
		{ element: "#btn-reset-code", popover: { title: "🔄 Reset Code", description: "Jika kode berantakan, ulangi dari awal di sini.", side: "bottom" } },
	];

	// 3. Konfigurasi Driver
	const driverObj = driver({
		showProgress: true,
		animate: true,
		allowClose: true,
		popoverClass: "cyber-theme",
		steps: tourSteps,

		// [FIX] Update index berdasarkan pencocokan ID Element (Lebih Stabil)
		onHighlightStarted: (element, step, options) => {
			if (step && step.element) {
				// Cari index step ini di array tourSteps
				const foundIndex = tourSteps.findIndex((s) => s.element === step.element);
				if (foundIndex !== -1) {
					activeIndex = foundIndex;
				}
			}
		},

		// Hook saat user mematikan tour
		onDestroyStarted: () => {
			// A. Jika sudah di langkah terakhir, biarkan selesai normal
			if (activeIndex === tourSteps.length - 1 || !driverObj.hasNextStep()) {
				localStorage.setItem("cyber_tour_finished", "true");
				driverObj.destroy();
				return;
			}

			// B. Simpan posisi saat ini ke variabel lokal (Frozen)
			const resumeIndex = activeIndex;

			// C. Hancurkan Tour Dulu (Agar tidak menghalangi Modal)
			driverObj.destroy();

			// D. Tampilkan Modal
			setTimeout(() => {
				showSystemModal(
					"Tutorial belum selesai. Yakin ingin melewatinya? <br><span class='text-xs opacity-70 mt-1 block'>(Anda tidak akan melihat panduan ini lagi)</span>",
					"skip_tour",

					// TOMBOL: YA, SKIP (Simpan Selesai)
					() => {
						localStorage.setItem("cyber_tour_finished", "true");
						setTimeout(() => window.virtualLog("system", ["Tour skipped by user."]), 500);
					},

					// TOMBOL: BATAL (Lanjutkan Tour)
					() => {
						// Delay sedikit agar modal hilang bersih dulu
						setTimeout(() => {
							// Panggil drive dengan index yang valid
							driverObj.drive(resumeIndex);
						}, 100);
					}
				);
			}, 300); // Delay muncul modal agar transisi halus
		},
	});

	// 4. Jalankan Tour
	setTimeout(() => {
		driverObj.drive();
	}, 1500);
}

// Panggil saat halaman dimuat
document.addEventListener("DOMContentLoaded", initCyberTour);

// ==========================================
// FITUR TOGGLE CONSOLE
// ==========================================

function toggleConsole(forceState = null) {
	const wrapper = document.getElementById("console-wrapper");
	const btn = document.getElementById("btn-toggle-console");

	if (!wrapper) return;

	// Logic Toggle Class
	// Jika forceState true -> Paksa Buka
	// Jika forceState false -> Paksa Tutup
	// Jika null -> Switch balik kondisi sekarang

	let isHidden = wrapper.classList.contains("hidden");
	let shouldOpen = forceState !== null ? forceState : isHidden;

	if (shouldOpen) {
		wrapper.classList.remove("hidden");
		// Ubah warna tombol jadi aktif (biar user tau console lagi nyala)
		if (btn) {
			btn.classList.add("bg-blue-600", "text-white", "border-blue-500");
			btn.classList.remove("bg-slate-800", "text-slate-300", "border-slate-700");
		}
		// Scroll ke paling bawah saat dibuka
		const consoleDiv = document.getElementById("virtual-console");
		if (consoleDiv) consoleDiv.scrollTop = consoleDiv.scrollHeight;
	} else {
		wrapper.classList.add("hidden");
		// Balikin warna tombol jadi standar
		if (btn) {
			btn.classList.remove("bg-blue-600", "text-white", "border-blue-500");
			btn.classList.add("bg-slate-800", "text-slate-300", "border-slate-700");
		}
	}
}

// ==========================================
// UPDATE: VIRTUAL LOG (AUTO OPEN ON ERROR)
// ==========================================
// Update fungsi ini agar console otomatis muncul kalau ada error
// ==========================================
// 4. VIRTUAL DEBUGGING (ICON ERROR BARU)
// ==========================================
window.virtualLog = function (type, messages) {
	const consoleDiv = document.getElementById("virtual-console");
	if (consoleDiv) {
		const row = document.createElement("div");
		row.className = "border-b border-white/5 pb-1 flex gap-2 break-all items-start"; // items-start agar icon sejajar atas

		// Default Icon (Info)
		let icon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-info-circle" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/><path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0"/></svg>`;
		let colorClass = "text-slate-300";

		// Logic Icon Berdasarkan Tipe
		if (type === "error") {
			// [ICON BARU DARI ANDA]
			icon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x-circle" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708"/></svg>`;
			colorClass = "text-red-500";
		} else if (type === "warn") {
			icon = "⚠️";
			colorClass = "text-yellow-400";
		} else if (type === "success") {
			icon = "✅";
			colorClass = "text-green-400";
		} else if (type === "system") {
			icon = "🤖";
			colorClass = "text-blue-400 italic";
		}

		const text = messages
			.map((msg) => {
				if (typeof msg === "object") return JSON.stringify(msg);
				return String(msg);
			})
			.join(" ");

		// Gunakan innerHTML agar SVG ter-render
		row.innerHTML = `<span class="opacity-70 select-none mt-0.5 ${colorClass}">${icon}</span> <span class="${colorClass}">${text}</span>`;
		consoleDiv.appendChild(row);
		consoleDiv.scrollTop = consoleDiv.scrollHeight;
	}

	// Sync ke Full Screen
	if (detachedWindow && !detachedWindow.closed && detachedWindow.logToChild) {
		detachedWindow.logToChild(type, messages.join(" "));
	}
};

// Helper function untuk render log (biar gak duplikat kode)
function renderLogToElement(elementId, type, messages) {
	const consoleDiv = document.getElementById(elementId);
	if (!consoleDiv) return;

	const row = document.createElement("div");
	row.className = "border-b border-white/5 pb-1 flex gap-2 break-all";

	let icon = "ℹ️";
	let colorClass = "text-slate-300";
	if (type === "error") {
		icon = "❌";
		colorClass = "text-red-400 font-bold";
	} else if (type === "warn") {
		icon = "⚠️";
		colorClass = "text-yellow-400";
	} else if (type === "success") {
		icon = "✅";
		colorClass = "text-green-400";
	}

	const text = messages.map((msg) => (typeof msg === "object" ? JSON.stringify(msg) : String(msg))).join(" ");
	row.innerHTML = `<span class="opacity-50 select-none flex-none">${icon}</span> <span class="${colorClass}">${text}</span>`;

	consoleDiv.appendChild(row);
	consoleDiv.scrollTop = consoleDiv.scrollHeight;
}

// ==========================================
// SISTEM DETACHED WINDOW (DUAL SCREEN)
// ==========================================

// ==========================================
// SISTEM DETACHED WINDOW (PRO VERSION)
// ==========================================

// ==========================================
// FITUR BARU: FULL SCREEN / DETACHED MODE
// ==========================================

// ==========================================
// 9. DETACHED WINDOW (FULL SCREEN) - ICON UPDATE
// ==========================================
// ==========================================
// 9. DETACHED WINDOW (FULL SCREEN) - FINAL UI
// ==========================================
// ==========================================
// 9. DETACHED WINDOW (FULL SCREEN) - ICON UPDATE
// ==========================================
// ==========================================
// 9. DETACHED WINDOW (FULL SCREEN) - ICON UPDATE
// ==========================================
function toggleDetachMode() {
	const placeholder = document.getElementById("detached-placeholder");
	const originalEditorArea = document.getElementById("code-editor");
	const originalPreviewArea = document.getElementById("preview-frame-container");
	const originalConsole = document.getElementById("console-wrapper");

	if (detachedWindow && !detachedWindow.closed) {
		detachedWindow.close();
		return;
	}

	let cssLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
		.map((l) => l.outerHTML)
		.join("\n");
	if (!cssLinks.includes("devicon")) cssLinks += '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/devicon.min.css">';

	const customStyle = `.ace-monokai{background-color:#020617!important;color:#f8f8f2!important}.ace-monokai .ace_gutter{background-color:#050505!important;color:#64748b!important;border-right:1px solid #1e293b!important}.ace_active-line{background-color:#1e293b!important}.custom-scrollbar::-webkit-scrollbar{width:8px;height:8px}.custom-scrollbar::-webkit-scrollbar-thumb{background:#334155;border-radius:4px} .hidden{display:none}`;
	const aceBase = "https://cdnjs.cloudflare.com/ajax/libs/ace/1.32.7";
	const safeFilesData = btoa(encodeURIComponent(JSON.stringify(virtualFiles)));

	// Icon UI
	const iRun = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-play-fill" viewBox="0 0 16 16"><path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/></svg>`;
	const iConsole = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-terminal" viewBox="0 0 16 16"><path d="M6 9a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3A.5.5 0 0 1 6 9M3.854 4.146a.5.5 0 1 0-.708.708L4.793 6.5 3.146 8.146a.5.5 0 1 0 .708.708l2-2a.5.5 0 0 0 0-.708z"/><path d="M2 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2zm12 1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/></svg>`;
	const iClear = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x" viewBox="0 0 16 16"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708"/></svg>`;

	// SVG ICONS LOG
	const iInfo = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-info-circle" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/><path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0"/></svg>`;
	const iWarn = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-exclamation-triangle" viewBox="0 0 16 16"><path d="M7.938 2.016A.13.13 0 0 1 8.002 2a.13.13 0 0 1 .063.016.15.15 0 0 1 .054.057l6.857 11.667c.036.06.035.124.002.183a.2.2 0 0 1-.054.06.1.1 0 0 1-.066.017H1.146a.1.1 0 0 1-.066-.017.2.2 0 0 1-.054-.06.18.18 0 0 1 .002-.183L7.884 2.073a.15.15 0 0 1 .054-.057m1.044-.45a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767z"/><path d="M7.002 12a1 1 0 1 1 2 0 1 1 0 0 1-2 0M7.1 5.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0z"/></svg>`;
	const iSuccess = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check-circle" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/><path d="m10.97 4.97-.02.022-3.473 4.425-2.093-2.094a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-1.071-1.05"/></svg>`;
	const iError = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x-circle" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708"/></svg>`;

	// Icon Folder
	const svgClosed = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-folder2 text-yellow-500" viewBox="0 0 16 16"><path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5zM2.5 3a.5.5 0 0 0-.5.5V6h12v-.5a.5.5 0 0 0-.5-.5H9c-.964 0-1.71-.629-2.174-1.154C6.374 3.334 5.82 3 5.264 3zM14 7H2v5.5a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5z"/></svg>`;
	const svgOpen = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-folder2-open text-yellow-500" viewBox="0 0 16 16"><path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0 1 15 5.5v.64c.57.265.94.876.856 1.546l-.64 5.124A2.5 2.5 0 0 1 12.733 15H3.266a2.5 2.5 0 0 1-2.481-2.19l-.64-5.124A1.5 1.5 0 0 1 1 6.14zM2 6h12v-.5a.5.5 0 0 0-.5-.5H9c-.964 0-1.71-.629-2.174-1.154C6.374 3.334 5.82 3 5.264 3H2.5a.5.5 0 0 0-.5.5zm-.367 1a.5.5 0 0 0-.496.562l.64 5.124A1.5 1.5 0 0 0 3.266 14h9.468a1.5 1.5 0 0 0 1.489-1.314l.64-5.124A.5.5 0 0 0 14.367 7z"/></svg>`;

	const childHTML = `
    <!DOCTYPE html>
    <html class="dark">
    <head>
        <title>Full Screen Editor</title>
        ${cssLinks}
        <style>${customStyle}
            body{margin:0;height:100vh;background:#0f172a;font-family:sans-serif;overflow:hidden;display:flex}
            #sidebar{width:220px;background:#1e293b;border-right:1px solid #334155;display:flex;flex-direction:column}
            #main{flex:1;display:flex}
            #left-col{width:50%;display:flex;flex-direction:column;border-right:1px solid #334155}
            #right-col{width:50%;display:flex;flex-direction:column}
            .header{padding:8px 15px;background:#0f172a;color:#94a3b8;font-size:11px;font-weight:bold;border-bottom:1px solid #334155;display:flex;justify-content:space-between;align-items:center}
            .folder-header { cursor:pointer; color:#94a3b8; font-size:12px; font-weight:bold; padding:5px 0; display:flex; align-items:center; gap:6px; }
            .folder-header:hover { color:white; }
            .file-item { padding:5px 0; color:#cbd5e1; cursor:pointer; font-size:13px; border-left:3px solid transparent; display:flex; gap:8px; align-items:center; transition:all 0.2s }
            .file-item:hover { background:#334155 }
            .file-item.active { background:#0f172a; border-left-color:#3b82f6; color:white; font-weight:bold }
            .file-item i { font-size:16px; width:16px; text-align:center }
            .btn-run{background:#2563eb;color:white;border:none;padding:5px 15px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:bold;display:flex;align-items:center;gap:6px;transition:0.2s}
            .btn-run:hover{background:#1d4ed8}
            .btn-clear{background:transparent; border:none; color:#94a3b8; cursor:pointer; padding:2px; border-radius:4px;}
            .btn-clear:hover{color:#f87171; background:rgba(255,255,255,0.05);}
            iframe{flex:1;border:none;background:white}
            #console{flex:1;background:#0c0c0c;color:#cbd5e1;font-family:monospace;font-size:12px;padding:10px;overflow-y:auto;}
            .log-err{color:#f87171}.log-warn{color:#facc15}
        </style>
        <script src="${aceBase}/ace.min.js"><\/script>
        <script src="${aceBase}/ext-language_tools.min.js"><\/script>
        <script src="${aceBase}/snippets/html.min.js"><\/script>
        <script src="${aceBase}/snippets/css.min.js"><\/script>
        <script src="${aceBase}/snippets/javascript.min.js"><\/script>
        <script src="${aceBase}/snippets/python.min.js"><\/script>
    </head>
    <body>
        <div id="sidebar"><div class="header">EXPLORER</div><div id="file-list" style="flex:1;overflow-y:auto;padding-top:10px" class="custom-scrollbar"></div></div>
        <div id="main">
            <div id="left-col"><div class="header"><span id="filename">loading...</span><span style="font-size:9px;background:#22c55e;color:#052e16;padding:2px 6px;rounded:4px">SYNC ACTIVE</span></div><div id="ace-editor" style="flex:1"></div></div>
            <div id="right-col">
                <div class="header">
                    <span>BROWSER PREVIEW</span>
                    <button class="btn-run" onclick="triggerRun()">${iRun} RUN CODE</button>
                </div>
                <iframe id="child-iframe"></iframe>
                <div style="height:150px; display:flex; flex-direction:column; border-top:1px solid #334155;">
                    <div class="header" style="background:#0f172a; border-bottom:none; padding:5px 15px;">
                        <span style="display:flex; align-items:center; gap:6px">${iConsole} CONSOLE</span>
                        <button class="btn-clear" onclick="document.getElementById('console').innerHTML = ''" title="Clear Log">${iClear}</button>
                    </div>
                    <div id="console" class="custom-scrollbar"><div style="opacity:0.5">> Console Ready...</div></div>
                </div>
            </div>
        </div>
        <script>
            var editor = ace.edit("ace-editor");
            editor.setTheme("ace/theme/monokai"); editor.setFontSize(14);
            editor.session.setUseWrapMode(true);
            editor.setOptions({ enableBasicAutocompletion: true, enableLiveAutocompletion: true, enableSnippets: true });

            var files = JSON.parse(decodeURIComponent(atob("${safeFilesData}")));
            var activeIdx = ${activeFileIndex};

            function triggerRun() { window.opener.runWeb(); }

            window.handleVirtualNavigation = function(target) {
                if(window.opener && window.opener.handleVirtualNavigation) window.opener.handleVirtualNavigation(target);
            };

            function renderFiles() {
                var c = document.getElementById('file-list');
                c.innerHTML = '';

                const iClosed = \`${svgClosed}\`;
                const iOpen = \`${svgOpen}\`;

                const fileTree = {};
                files.forEach((file, index) => {
                    const parts = file.name.split('/');
                    let currentLevel = fileTree;
                    parts.forEach((part, i) => {
                        if (i === parts.length - 1) {
                            currentLevel[part] = { type: 'file', index: index, name: file.name, displayName: part };
                        } else {
                            if (!currentLevel[part]) currentLevel[part] = { type: 'folder', children: {} };
                            currentLevel = currentLevel[part].children;
                        }
                    });
                });

                function buildTreeHTML(tree, level = 0) {
                    let html = '';
                    const keys = Object.keys(tree).sort((a, b) => {
                        const typeA = tree[a].type; const typeB = tree[b].type;
                        if (typeA === typeB) return a.localeCompare(b);
                        return typeA === 'folder' ? -1 : 1;
                    });

                    keys.forEach(key => {
                        const item = tree[key];
                        const padding = level * 15 + 10;
                        if (item.type === 'folder') {
                            html += \`<div class="folder-group">
                                <div class="folder-header" style="padding-left:\${padding}px"
                                     onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.icon-closed').classList.toggle('hidden'); this.querySelector('.icon-open').classList.toggle('hidden');">
                                    <span class="icon-closed">\${iClosed}</span>
                                    <span class="icon-open hidden">\${iOpen}</span>
                                    <span style="margin-top:1px;">\${key}</span>
                                </div>
                                <div class="folder-content">\${buildTreeHTML(item.children, level + 1)}</div>
                            </div>\`;
                        } else {
                            let icon = "devicon-vscode-plain text-slate-400";
                            if (item.name.endsWith(".html")) icon = "devicon-html5-plain text-orange-500";
                            else if (item.name.endsWith(".css")) icon = "devicon-css3-plain text-blue-500";
                            else if (item.name.endsWith(".js")) icon = "devicon-javascript-plain text-yellow-500";

                            const activeClass = (item.index === activeIdx) ? 'active' : '';
                            html += \`<div class="file-item \${activeClass}" style="padding-left:\${padding}px" onclick="window.opener.openFile(\${item.index})">
                                <i class="\${icon}"></i> <span>\${item.displayName}</span>
                            </div>\`;
                        }
                    });
                    return html;
                }
                c.innerHTML = buildTreeHTML(fileTree);
            }

            window.openChildFile = function(idx) {
                activeIdx = idx; renderFiles();
                document.getElementById('filename').innerText = files[idx].name;
                var mode = "html";
                if(files[idx].name.endsWith(".css")) mode = "css";
                else if(files[idx].name.endsWith(".js")) mode = "javascript";
                editor.session.setMode("ace/mode/" + mode);
                if(editor.getValue() !== files[idx].content) editor.setValue(files[idx].content, -1);
            };

            window.updateChildEditor = function(fname, content) {
                var f = files.find(x => x.name === fname);
                if(f) {
                    f.content = content;
                    if(files[activeIdx].name === fname && editor.getValue() !== content) {
                        var pos = editor.getCursorPosition();
                        editor.setValue(content, -1);
                        editor.moveCursorToPosition(pos);
                        editor.clearSelection();
                    }
                }
            };

            editor.session.on('change', function() {
                var val = editor.getValue(); files[activeIdx].content = val;
                window.opener.syncFromChild(files[activeIdx].name, val);
            });

            window.updatePreview = function(html) {
                var doc = document.getElementById('child-iframe').contentDocument;
                doc.open(); doc.write(html); doc.close();
            };

            window.logToChild = function(type, msg) {
                var c = document.getElementById('console');
                var d = document.createElement('div');
                d.className = 'flex gap-2 items-start mb-1 break-all'; // Flex + Break All

                // SVG Icons
                const iInfo = \`${iInfo}\`;
                const iWarn = \`${iWarn}\`;
                const iSuccess = \`${iSuccess}\`;
                const iError = \`${iError}\`;

                let icon = iInfo;
                let col = 'text-slate-300';

                if(type==='error') { icon = iError; col='text-red-500'; }
                else if(type==='warn') { icon = iWarn; col='text-yellow-400'; }
                else if(type==='success') { icon = iSuccess; col='text-green-400'; }

                d.innerHTML = \`<span class="opacity-80 mt-0.5 \${col}">\${icon}</span> <span class="\${col}">\${msg}</span>\`;
                c.appendChild(d); c.scrollTop = c.scrollHeight;
            };

            window.virtualLog = function(type, args) {
                var msg = Array.isArray(args) ? args.join(' ') : String(args);
                logToChild(type, msg);
                if(window.opener && window.opener.renderLogToElement) window.opener.renderLogToElement('virtual-console', type, [msg]);
            };

            renderFiles(); openChildFile(activeIdx);
        <\/script>
    </body>
    </html>`;

	detachedWindow = window.open("", "DetachedMode", "width=1280,height=800");
	if (!detachedWindow) {
		alert("Izinkan Pop-up!");
		return;
	}
	detachedWindow.document.write(childHTML);
	detachedWindow.document.close();

	if (originalEditorArea) originalEditorArea.classList.add("hidden");
	if (originalPreviewArea) originalPreviewArea.classList.add("hidden");
	if (originalConsole) originalConsole.classList.add("hidden");
	if (placeholder) {
		placeholder.classList.remove("hidden");
		placeholder.classList.add("flex");
	}

	if (detachWatcher) clearInterval(detachWatcher);
	detachWatcher = setInterval(() => {
		if (!detachedWindow || detachedWindow.closed) resetToNormalMode();
	}, 1000);
	setTimeout(() => runWeb(), 1000);
}

// Fungsi reset tampilan parent
function resetToNormalMode() {
	clearInterval(detachWatcher);
	detachedWindow = null;

	const placeholder = document.getElementById("detached-placeholder");
	const originalEditorArea = document.getElementById("code-editor");
	const originalPreviewArea = document.getElementById("preview-frame-container");
	const originalConsole = document.getElementById("console-wrapper");

	if (placeholder) {
		placeholder.classList.add("hidden");
		placeholder.classList.remove("flex");
	}
	if (originalEditorArea) originalEditorArea.classList.remove("hidden");
	if (originalPreviewArea) originalPreviewArea.classList.remove("hidden");
	if (originalConsole) originalConsole.classList.add("hidden");

	// [FIX] Force refresh konten editor parent dari memori virtualFiles
	if (virtualFiles[activeFileIndex]) {
		editor.setValue(virtualFiles[activeFileIndex].content, -1);
		editor.resize(); // Recalculate layout
		editor.renderer.updateFull(); // Force repaint
	}

	// Render ulang list file (opsional)
	renderFileList();
}

// Fungsi Sync dari Anak ke Parent
window.syncFromChild = function (filename, content) {
	const file = virtualFiles.find((f) => f.name === filename);
	if (file) {
		file.content = content;

		// Update editor parent jika file yang sama sedang dibuka
		if (virtualFiles[activeFileIndex].name === filename) {
			// Cek apakah konten beda agar tidak repaint berlebihan
			if (editor.getValue() !== content) {
				isSyncing = true; // [FIX] Nyalakan Flag: "Ini update dari sistem, bukan user ngetik"

				// Gunakan setValue dengan parameter 1 (kursor di akhir) atau cursor posisi lama
				// Tapi karena user sedang ngetik di window lain, posisi kursor parent tidak terlalu penting
				// yang penting isinya terupdate.
				editor.setValue(content, 1);

				isSyncing = false; // [FIX] Matikan Flag
			}
		}
	}
};
