/**
 * Default Background Factory
 * Classic gradient background with floating sparkles
 */

import { ThemeConfig } from '../../types/GameConfig';
import { BackgroundFactory } from '../BackgroundRegistry';
import { createGradientSky, createFloatingParticles } from '../BackgroundUtils';

export const createDefaultBackground: BackgroundFactory = (
	scene: Phaser.Scene,
	width: number,
	height: number,
	theme: ThemeConfig
): Phaser.GameObjects.Container => {
	const container = scene.add.container(0, 0);

	// Gradient sky
	const sky = createGradientSky(scene, width, height, [
		{ y: 0, color: 0x1F2937 },
		{ y: 0.5, color: 0x374151 },
		{ y: 1, color: 0x4B5563 }
	], 1);
	container.add(sky);

	// Floating particles
	createFloatingParticles(scene, width, height, ['✨', '💫'], container);

	return container;
};

export default createDefaultBackground;
