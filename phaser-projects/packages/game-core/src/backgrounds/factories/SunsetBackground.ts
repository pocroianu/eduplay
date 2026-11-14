/**
 * Sunset Background Factory
 * Warm orange and purple gradient with sun and silhouette hills
 */

import { ThemeConfig } from '../../types/GameConfig';
import { BackgroundFactory } from '../BackgroundRegistry';
import { createGradientSky, createSmoothHill, createFloatingParticles } from '../BackgroundUtils';

/**
 * Create sunset sun with glow
 */
function createSunsetSun(
	scene: Phaser.Scene,
	width: number,
	height: number,
	container: Phaser.GameObjects.Container
): void {
	const sun = scene.add.circle(
		width * 0.7,
		height * 0.5,
		80,
		0xFFEB3B,
		0.8
	);
	container.add(sun);

	// Sun glow
	const glow = scene.add.circle(
		width * 0.7,
		height * 0.5,
		120,
		0xFFEB3B,
		0.2
	);
	container.add(glow);
}

/**
 * Create silhouette hills
 */
function createSilhouetteHills(
	scene: Phaser.Scene,
	width: number,
	height: number,
	container: Phaser.GameObjects.Container
): void {
	const hill1 = createSmoothHill(scene, width, height, 0x1A1A1A, height * 0.7, 60, 0);
	container.add(hill1);

	const hill2 = createSmoothHill(scene, width, height, 0x2D2D2D, height * 0.8, 40, 150);
	container.add(hill2);
}

export const createSunsetBackground: BackgroundFactory = (
	scene: Phaser.Scene,
	width: number,
	height: number,
	theme: ThemeConfig
): Phaser.GameObjects.Container => {
	const container = scene.add.container(0, 0);

	// Sunset gradient (purple to orange to yellow)
	const sky = createGradientSky(scene, width, height, [
		{ y: 0, color: 0x4A148C },
		{ y: 0.3, color: 0x7B1FA2 },
		{ y: 0.5, color: 0xE91E63 },
		{ y: 0.7, color: 0xFF5722 },
		{ y: 0.85, color: 0xFF9800 },
		{ y: 1, color: 0xFFEB3B }
	], 1);
	container.add(sky);

	// Sun
	createSunsetSun(scene, width, height, container);

	// Silhouette hills
	createSilhouetteHills(scene, width, height, container);

	// Floating particles
	createFloatingParticles(scene, width, height, ['🌅', '🦅', '✨'], container);

	return container;
};

export default createSunsetBackground;
