/**
 * Forest Background Factory
 * Deep woods with layered canopy and earthy tones
 */

import Phaser from 'phaser';
import { ThemeConfig } from '../../types/GameConfig';
import { BackgroundFactory } from '../BackgroundRegistry';
import { createGradientSky, createGround, createFloatingParticles } from '../BackgroundUtils';

/**
 * Create forest canopy layer
 */
function createForestCanopy(
	scene: Phaser.Scene,
	width: number,
	height: number,
	color: number,
	baseY: number,
	alpha: number,
	container: Phaser.GameObjects.Container
): void {
	const graphics = scene.add.graphics();
	graphics.fillStyle(color, alpha);
	graphics.beginPath();
	graphics.moveTo(0, height);
	graphics.lineTo(0, baseY);

	// Create smooth rolling canopy using overlapping curves
	let x = 0;
	while (x <= width + 100) {
		const bumpWidth = Phaser.Math.Between(80, 150);
		const bumpHeight = Phaser.Math.Between(30, 60);

		// Draw smooth bump (half circle / arc shape)
		const centerX = x + bumpWidth / 2;
		const startY = baseY + Phaser.Math.Between(-10, 10);

		// Use quadratic curve for smooth tree tops
		graphics.lineTo(x, startY);
		graphics.arc(centerX, startY, bumpWidth / 2, Math.PI, 0, false);

		x += bumpWidth - Phaser.Math.Between(10, 30); // Overlap slightly
	}

	graphics.lineTo(width, height);
	graphics.closePath();
	graphics.fillPath();
	container.add(graphics);
}

export const createForestBackground: BackgroundFactory = (
	scene: Phaser.Scene,
	width: number,
	height: number,
	theme: ThemeConfig
): Phaser.GameObjects.Container => {
	const container = scene.add.container(0, 0);

	// Sky peeking through trees at top
	const sky = createGradientSky(scene, width, height, [
		{ y: 0, color: 0x87CEEB },
		{ y: 0.5, color: 0xA5D6A7 },
		{ y: 1, color: 0x66BB6A }
	], 0.2);
	container.add(sky);

	// Dense forest canopy layers (using smooth curves)
	createForestCanopy(scene, width, height, 0x1B5E20, height * 0.15, 0.95, container);  // Darkest, back
	createForestCanopy(scene, width, height, 0x2E7D32, height * 0.25, 0.9, container);   // Medium
	createForestCanopy(scene, width, height, 0x388E3C, height * 0.35, 0.85, container);  // Lighter, front

	// Forest floor
	const ground = createGround(scene, width, height, [0x4E342E, 0x3E2723, 0x2D1F1A], 0.55);
	container.add(ground);

	// Floating particles
	createFloatingParticles(scene, width, height, ['🍂', '🍁', '🌿', '🍃'], container);

	return container;
};

export default createForestBackground;
