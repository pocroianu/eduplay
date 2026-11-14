/**
 * Candy Background Factory
 * Sweet pink theme with candy stripes and floating treats
 */

import { ThemeConfig } from '../../types/GameConfig';
import { BackgroundFactory } from '../BackgroundRegistry';
import { createGradientSky, createFloatingParticles } from '../BackgroundUtils';

/**
 * Create candy stripes pattern
 */
function createCandyStripes(
	scene: Phaser.Scene,
	width: number,
	height: number,
	container: Phaser.GameObjects.Container
): void {
	const graphics = scene.add.graphics();
	const stripeWidth = 60;

	for (let i = 0; i < width / stripeWidth + 2; i++) {
		if (i % 2 === 0) {
			graphics.fillStyle(0xFFFFFF, 0.2);
			graphics.fillRect(i * stripeWidth - 30, 0, stripeWidth, height);
		}
	}

	container.add(graphics);
}

export const createCandyBackground: BackgroundFactory = (
	scene: Phaser.Scene,
	width: number,
	height: number,
	theme: ThemeConfig
): Phaser.GameObjects.Container => {
	const container = scene.add.container(0, 0);

	// Pink gradient
	const sky = createGradientSky(scene, width, height, [
		{ y: 0, color: 0xFCE4EC },
		{ y: 0.5, color: 0xF8BBD9 },
		{ y: 1, color: 0xF48FB1 }
	], 1);
	container.add(sky);

	// Candy stripes
	createCandyStripes(scene, width, height, container);

	// Floating particles
	createFloatingParticles(scene, width, height, ['🍬', '🍭', '🧁', '🍩', '🎀'], container);

	return container;
};

export default createCandyBackground;
