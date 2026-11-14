
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
import Phaser from "phaser";
import ConfigLoader from "../services/ConfigLoader";
import i18n from "../i18n";
import type { GameWithAssets, PhaserAssetPack } from "../types/AssetSchema";
import { HydratedGameConfig } from "../types/ConfigSchema";
import {
	getPreviewRuntimeSettings
} from "../previewRuntime";
import { loadGoogleFont } from "../utils/FontLoader";

// Feature flag for dynamic asset loading
const USE_DYNAMIC_ASSETS = true;
/* END-USER-IMPORTS */

export default class Preload extends Phaser.Scene {

	constructor() {
		super("Preload");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	editorCreate(): void {

		// guapen
		const guapen = this.add.image(505.0120544433594, 360, "guapen");
		guapen.scaleX = 0.32715486817515643;
		guapen.scaleY = 0.32715486817515643;

		// progressBar
		const progressBar = this.add.rectangle(553.0120849609375, 361, 256, 20);
		progressBar.setOrigin(0, 0);
		progressBar.isFilled = true;
		progressBar.fillColor = 14737632;

		// progressBarBg
		const progressBarBg = this.add.rectangle(553.0120849609375, 361, 256, 20);
		progressBarBg.setOrigin(0, 0);
		progressBarBg.fillColor = 14737632;
		progressBarBg.isStroked = true;

		// loadingText
		const loadingText = this.add.text(552.0120849609375, 329, "", {});
		loadingText.text = "Loading...";
		loadingText.setStyle({ "color": "#e0e0e0", "fontFamily": "'Nunito', Arial, sans-serif", "fontSize": "20px", "fontStyle": "bold" });

		this.progressBar = progressBar;

		this.events.emit("scene-awake");
	}

	private progressBar!: Phaser.GameObjects.Rectangle;

	/* START-USER-CODE */

	// Dynamic loading state
	private loadedConfig: HydratedGameConfig | null = null;
	private loadError: string | null = null;
	private progressBarWidth: number = 0;
	private readonly handleLoadProgress = (value: number) => {
		this.progressBar.width = this.progressBarWidth * value;
	};

	preload() {
		this.editorCreate();
		this.progressBarWidth = this.progressBar.width;

		// Setup progress tracking
		this.load.on("progress", this.handleLoadProgress);

		if (USE_DYNAMIC_ASSETS) {
			// Boot scene already loaded the editor shell assets.
			// Game-specific assets will be loaded in create() after config is loaded.
		} else {
			// Legacy mode is not used by the current templates.
		}
	}

	async create() {
		// Development mode: allow jumping to specific scene
		if (process.env.NODE_ENV === "development") {
			const start = new URLSearchParams(location.search).get("start");
			if (start) {
				console.log(`Development: jump to ${start}`);
				this.scene.start(start);
				return;
			}
		}

		// Load Nunito font (non-blocking — game works without it)
		await loadGoogleFont('Nunito', [400, 600, 700, 800, 900]);

		if (USE_DYNAMIC_ASSETS) {
			await this.loadGameWithDynamicAssets();
		} else {
			this.scene.start("Level");
		}
	}

	/**
	 * Load game config and its specific assets dynamically
	 */
	private async loadGameWithDynamicAssets(): Promise<void> {
		try {
			// Get game ID and language from URL
			const preview = getPreviewRuntimeSettings();
			const gameId = preview.gameId || ConfigLoader.getGameIdFromUrl() || 'fruits-01';
			const urlLang = preview.language || ConfigLoader.getLanguageFromUrl();
			if (urlLang) {
				i18n.setLanguage(urlLang);
			}

			// Load config with asset resolution
			const configLoader = ConfigLoader.getInstance();
			const gameWithAssets = await configLoader.loadGameWithAssets({
				gameId,
				language: i18n.getLanguage()
			});
			const { config, assetPack } = gameWithAssets;

			this.loadedConfig = config;
			this.logSelectedAssets(gameId, gameWithAssets);

			// Load game-specific assets dynamically
			await this.loadGameAssets(assetPack);

			// Start Level scene with the loaded config
			this.scene.start("Level", { config: this.loadedConfig });

		} catch (error: any) {
			console.error('Failed to load game:', error);
			this.loadError = error.message;
			this.showError();
		}
	}

	/**
	 * Load game-specific assets dynamically
	 * Called after config is loaded to load only required assets
	 */
	private loadGameAssets(assetPack: PhaserAssetPack): Promise<void> {
		return new Promise((resolve, reject) => {
			// Reset progress bar for game assets
			this.progressBar.width = 0;
			this.load.reset();
			this.load.on("progress", this.handleLoadProgress);

			const queuedFiles: string[] = [];
			const failedFiles: string[] = [];
			const packData = assetPack as { game?: { files?: Array<Record<string, unknown>> } };
			const files = packData.game?.files ?? [];

			for (const file of files) {
				const key = typeof file.key === "string" ? file.key : "";
				if (!key) {
					continue;
				}

				if (file.type === "image") {
					if (this.textures.exists(key)) {
						continue;
					}
					const url = typeof file.url === "string" ? file.url : "";
					if (!url) {
						continue;
					}
					this.load.image(key, url);
					queuedFiles.push(`${key} -> ${url}`);
					continue;
				}

				if (file.type === "audio") {
					if (this.cache.audio.exists(key)) {
						continue;
					}
					const urls = Array.isArray(file.url) ? file.url : [file.url];
					const validUrls = urls.filter((value): value is string => typeof value === "string" && value.length > 0);
					if (validUrls.length === 0) {
						continue;
					}
					this.load.audio(key, validUrls);
					queuedFiles.push(`${key} -> ${validUrls.join(", ")}`);
					continue;
				}

				if (file.type === "atlas") {
					if (this.textures.exists(key)) {
						continue;
					}
					const textureUrl = typeof file.textureURL === "string" ? file.textureURL : typeof file.url === "string" ? file.url : "";
					const atlasUrl = typeof file.atlasURL === "string" ? file.atlasURL : "";
					if (!textureUrl || !atlasUrl) {
						continue;
					}
					this.load.atlas(key, textureUrl, atlasUrl);
					queuedFiles.push(`${key} -> ${textureUrl} + ${atlasUrl}`);
				}
			}

			if (queuedFiles.length === 0) {
				console.info("[Preload] No new dynamic assets required for this game.");
				resolve();
				return;
			}

			console.info("[Preload] Queueing dynamic assets:", queuedFiles);

			const onComplete = () => {
				this.load.off("loaderror", onLoadError);
				if (failedFiles.length > 0) {
					reject(new Error(`Failed to load required assets: ${failedFiles.join(", ")}`));
					return;
				}
				resolve();
			};

			const onLoadError = (file: { key?: string; src?: string }): void => {
				const descriptor = `${file.key ?? "unknown"} (${file.src ?? "unknown source"})`;
				failedFiles.push(descriptor);
				console.error(`[Preload] Failed to load required asset ${descriptor}`);
			};

			this.load.once("complete", onComplete);
			this.load.on("loaderror", onLoadError);
			this.load.start();
		});
	}

	private logSelectedAssets(gameId: string, gameWithAssets: GameWithAssets): void {
		const imageCount = gameWithAssets.manifest.images.length;
		const audioCount = gameWithAssets.manifest.audio.length;
		const spriteCount = gameWithAssets.manifest.spritesheets?.length ?? 0;

		console.info("[Preload] Selected manifest", {
			gameId,
			source: gameWithAssets.manifestSource,
			images: gameWithAssets.manifest.images,
			audio: gameWithAssets.manifest.audio,
			spritesheets: gameWithAssets.manifest.spritesheets ?? [],
			counts: {
				images: imageCount,
				audio: audioCount,
				spritesheets: spriteCount
			}
		});
	}

	/**
	 * Show error message when loading fails
	 */
	private showError(): void {
		const { width, height } = this.cameras.main;
		this.add.text(width / 2, height / 2, `Error: ${this.loadError}`, {
			fontSize: '24px',
			color: '#ff0000',
			align: 'center'
		}).setOrigin(0.5);
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
