/**
 * Ocean Background Factory
 * Deep blue waters with animated wave lines
 */

import { ThemeConfig } from '../../types/GameConfig';
import { BackgroundFactory } from '../BackgroundRegistry';
import { createClouds, createFloatingParticles } from '../BackgroundUtils';

/**
 * Create the static sky with lightweight rectangles.
 * Large static Phaser Graphics fills are expensive to render every frame,
 * especially in software/WebGL fallback contexts used by school devices and CI.
 */
function createOceanSky(
	scene: Phaser.Scene,
	width: number,
	height: number
): Phaser.GameObjects.Container {
	const sky = scene.add.container(0, 0);
	const skyHeight = height * 0.25;
	const bands = [0x87CEEB, 0x6ACBF1, 0x4FC3F7, 0x68CBF8, 0x81D4FA];
	const bandHeight = Math.ceil(skyHeight / bands.length);

	bands.forEach((color, index) => {
		const rect = scene.add.rectangle(0, index * bandHeight, width, bandHeight + 1, color).setOrigin(0, 0);
		sky.add(rect);
	});

	return sky;
}

/**
 * Create animated wave line
 */
function createWaveLine(
	scene: Phaser.Scene,
	width: number,
	baseY: number,
	amplitude: number,
	offset: number,
	color: number,
	alpha: number,
	container: Phaser.GameObjects.Container
): void {
	const graphics = scene.add.graphics();
	graphics.lineStyle(3, color, alpha);
	graphics.beginPath();
	graphics.moveTo(-120, baseY + Math.sin((-120 + offset) / 60 * Math.PI) * amplitude);

	for (let x = -115; x <= width + 120; x += 5) {
		const wave = Math.sin((x + offset) / 60 * Math.PI) * amplitude;
		graphics.lineTo(x, baseY + wave);
	}
	graphics.strokePath();
	container.add(graphics);

	// Animate the pre-drawn wave by one sine period instead of redrawing Graphics every frame.
	scene.tweens.add({
		targets: graphics,
		x: -120,
		duration: 4000 + offset * 10,
		repeat: -1,
		ease: 'Linear',
		onRepeat: () => {
			graphics.x = 0;
		}
	});
}

export const createOceanBackground: BackgroundFactory = (
	scene: Phaser.Scene,
	width: number,
	height: number,
	theme: ThemeConfig
): Phaser.GameObjects.Container => {
	const container = scene.add.container(0, 0);

	scene.cameras.main.setBackgroundColor(0x0277BD);
	container.add(createOceanSky(scene, width, height));

	// Gentle wave lines on top
	for (let i = 0; i < 6; i++) {
		const y = height * 0.3 + i * 50;
		createWaveLine(scene, width, y, 8 - i, i * 100, 0x039BE5, 0.4 - i * 0.05, container);
	}

	// Clouds
	createClouds(scene, width, 0xFFFFFF, container);

	// Floating particles
	createFloatingParticles(scene, width, height, ['🐟', '🐠', '🦀', '🐚'], container);

	return container;
};

export default createOceanBackground;
