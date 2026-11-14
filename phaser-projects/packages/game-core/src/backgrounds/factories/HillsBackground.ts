/**
 * Hills Background Factory
 * Nature theme with rolling hills, sky gradient, and clouds
 */

import { ThemeConfig } from '../../types/GameConfig';
import { BackgroundFactory } from '../BackgroundRegistry';
import {
	createGradientSky,
	createSmoothHill,
	createGround,
	createClouds,
	createFloatingParticles
} from '../BackgroundUtils';

export const createHillsBackground: BackgroundFactory = (
	scene: Phaser.Scene,
	width: number,
	height: number,
	theme: ThemeConfig
): Phaser.GameObjects.Container => {
	const container = scene.add.container(0, 0);

	// Sky gradient
	const sky = createGradientSky(scene, width, height, [
		{ y: 0, color: 0x87CEEB },
		{ y: 0.3, color: 0xB0E0E6 },
		{ y: 0.5, color: 0xE0F4FF },
		{ y: 0.65, color: 0xF0F8FF }
	], 0.65);
	container.add(sky);

	// Hills (layered from back to front)
	const hill1 = createSmoothHill(scene, width, height, 0x3D6B4F, height * 0.42, 50, 0);
	container.add(hill1);

	const hill2 = createSmoothHill(scene, width, height, 0x4A8C5C, height * 0.48, 40, 100);
	container.add(hill2);

	const hill3 = createSmoothHill(scene, width, height, 0x6AAF6A, height * 0.54, 35, 200);
	container.add(hill3);

	// Ground
	const ground = createGround(scene, width, height, [0x9B8B6B, 0x8B7B5B, 0x7A6A4A], 0.58);
	container.add(ground);

	// Clouds
	createClouds(scene, width, 0xFFFFFF, container);

	// Floating particles
	createFloatingParticles(scene, width, height, ['🍃', '🌿', '☘️'], container);

	return container;
};

export default createHillsBackground;
