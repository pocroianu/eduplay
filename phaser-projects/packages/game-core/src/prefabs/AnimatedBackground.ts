import Phaser from 'phaser';
import { ThemeConfig, BackgroundStyle } from '../types/GameConfig';
import BackgroundRegistry from '../backgrounds/BackgroundRegistry';

export interface AnimatedBackgroundConfig {
	width: number;
	height: number;
	theme?: ThemeConfig;
}

/**
 * AnimatedBackground - Creates theme-specific animated backgrounds using BackgroundRegistry
 *
 * Now uses the registry pattern for runtime-extensible backgrounds.
 * Built-in styles: hills, ocean, space, candy, forest, sunset, default
 * Custom styles can be registered via BackgroundRegistry.getInstance().register()
 */
export default class AnimatedBackground extends Phaser.GameObjects.Container {
	private screenWidth: number;
	private screenHeight: number;
	private theme: ThemeConfig;
	private style: BackgroundStyle;
	private backgroundContainer: Phaser.GameObjects.Container | null = null;

	constructor(scene: Phaser.Scene, config: AnimatedBackgroundConfig) {
		super(scene, 0, 0);

		this.screenWidth = config.width;
		this.screenHeight = config.height;
		this.theme = config.theme || {} as ThemeConfig;
		this.style = this.theme.backgroundStyle || 'default';

		this.createBackground();

		scene.add.existing(this);
		this.setDepth(-10);
	}

	/**
	 * Create background using BackgroundRegistry
	 */
	private createBackground(): void {
		const registry = BackgroundRegistry.getInstance();

		// Create background using registry
		this.backgroundContainer = registry.create(
			this.style,
			this.scene,
			this.screenWidth,
			this.screenHeight,
			this.theme
		);

		// Add to this container
		this.add(this.backgroundContainer);
	}

	/**
	 * Get the current background style
	 */
	public getStyle(): BackgroundStyle {
		return this.style;
	}

	/**
	 * Check if a background style is available
	 */
	public static isStyleAvailable(styleName: string): boolean {
		return BackgroundRegistry.getInstance().has(styleName);
	}

	/**
	 * Get all available background styles
	 */
	public static getAvailableStyles(): string[] {
		return BackgroundRegistry.getInstance().getAvailableStyles();
	}

	/**
	 * Clean up resources
	 */
	destroy(): void {
		// Cleanup is now handled by the container itself
		// All child game objects will be destroyed automatically
		super.destroy();
	}
}
