import { BrowserWindow, Updater, Utils } from "electrobun/bun";

const pkg = await import("../../package.json");
const version: string = pkg.default.version;

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

// Check if Vite dev server is running for HMR
async function getMainViewUrl(): Promise<string> {
	const channel = await Updater.localInfo.channel();
	if (channel === "dev") {
		try {
			await fetch(DEV_SERVER_URL, { method: "HEAD" });
			console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
			return DEV_SERVER_URL;
		} catch {
			console.log(
				"Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
			);
		}
	}
	return "views://mainview/index.html";
}

// Auto-update: check → prompt → download → apply
async function checkAndApplyUpdate(): Promise<void> {
	const channel = await Updater.localInfo.channel();

	// Skip updates in dev channel
	if (channel === "dev") {
		console.log("[updater] Dev channel — skipping update check.");
		return;
	}

	console.log("[updater] Checking for updates...");

	try {
		const result = await Updater.checkForUpdate();
		console.log(
			`[updater] Current: ${result.version} (${result.hash}), updateAvailable: ${result.updateAvailable}`,
		);

		if (!result.updateAvailable) {
			console.log("[updater] App is up to date.");
			return;
		}

		// Prompt user before downloading
		const currentVersion = await Updater.localInfo.version();
		const { response } = await Utils.showMessageBox({
			type: "question",
			title: "发现新版本",
			message: `新版本 ${result.version} 已发布`,
			detail: `当前版本：${currentVersion}\n新版本：${result.version}\n\n是否立即下载并安装？安装完成后应用将自动重启。`,
			buttons: ["立即更新", "稍后再说"],
			defaultId: 0,
			cancelId: 1,
		});

		if (response !== 0) {
			console.log("[updater] User deferred update.");
			return;
		}

		// Subscribe to status events for progress logging
		Updater.onStatusChange((entry) => {
			const { status, message, details } = entry;
			if (details?.progress !== undefined) {
				console.log(
					`[updater] ${status}: ${message} (${Math.round(details.progress * 100)}%)`,
				);
			} else {
				console.log(`[updater] ${status}: ${message}`);
			}
		});

		console.log("[updater] Downloading update...");
		await Updater.downloadUpdate();

		console.log("[updater] Applying update and restarting...");
		await Updater.applyUpdate();
	} catch (err) {
		console.error("[updater] Update failed:", err);
	} finally {
		Updater.onStatusChange(null);
	}
}

// Create the main application window
const url = await getMainViewUrl();

new BrowserWindow({
	title: "React + Tailwind + Vite + Bun -->" + version,
	url,
	frame: {
		width: 900,
		height: 800,
		x: 400,
		y: 400,
	},
});

console.log("React Tailwind Vite app started!");

// Run update check after window is created (non-blocking)
checkAndApplyUpdate();
