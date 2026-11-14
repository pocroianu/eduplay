/**
 * Space Background Factory
 * Dark cosmos with twinkling stars and nebula
 */

import Phaser from 'phaser';
import { ThemeConfig } from '../../types/GameConfig';
import { BackgroundFactory } from '../BackgroundRegistry';
import { createGradientSky, createFloatingParticles } from '../BackgroundUtils';

/**
 * Create twinkling stars
 */
function createStars(
	scene: Phaser.Scene,
	width: number,
	height: number,
	container: Phaser.GameObjects.Container
): void {
	for (let i = 0; i < 100; i++) {
		const x = Phaser.Math.Between(0, width);
		const y = Phaser.Math.Between(0, height);
		const size = Phaser.Math.Between(1, 3);
		const alpha = Phaser.Math.FloatBetween(0.3, 1);

		const star = scene.add.circle(x, y, size, 0xFFFFFF, alpha);
		container.add(star);

		// Twinkle animation
		scene.tweens.add({
			targets: star,
			alpha: alpha * 0.3,
			duration: Phaser.Math.Between(1000, 3000),
			yoyo: true,
			repeat: -1,
			ease: 'Sine.easeInOut'
		});
	}
}

/**
 * Create nebula clouds
 */
function createNebula(
	scene: Phaser.Scene,
	width: number,
	height: number,
	container: Phaser.GameObjects.Container
): void {
	const graphics = scene.add.graphics();

	// Purple nebula clouds
	for (let i = 0; i < 5; i++) {
		const x = Phaser.Math.Between(0, width);
		const y = Phaser.Math.Between(0, height);
		const radius = Phaser.Math.Between(100, 200);

		graphics.fillStyle(0x7C4DFF, 0.1);
		graphics.fillCircle(x, y, radius);
		graphics.fillStyle(0xE040FB, 0.05);
		graphics.fillCircle(x + 30, y - 20, radius * 0.7);
	}

	container.add(graphics);
}

export const createSpaceBackground: BackgroundFactory = (
	scene: Phaser.Scene,
	width: number,
	height: number,
	theme: ThemeConfig
): Phaser.GameObjects.Container => {
	const container = scene.add.container(0, 0);

	// Dark space gradient
	const sky = createGradientSky(scene, width, height, [
		{ y: 0, color: 0x0D0D1A },
		{ y: 0.5, color: 0x1A1A2E },
		{ y: 1, color: 0x16213E }
	], 1);
	container.add(sky);

	// Stars
	createStars(scene, width, height, container);

	// Nebula
	createNebula(scene, width, height, container);

	// Floating particles
	createFloatingParticles(scene, width, height, ['⭐', '✨', '💫', '🌟'], container);

	return container;
};

export default createSpaceBackground;
