/**
 * Shared utilities for background creation
 * These functions are used across multiple background factories
 */

import Phaser from 'phaser';
import { ThemeConfig } from '../types/GameConfig';

/**
 * Create a gradient sky with multiple color stops
 */
export function createGradientSky(
	scene: Phaser.Scene,
	width: number,
	height: number,
	colors: { y: number; color: number }[],
	heightRatio: number
): Phaser.GameObjects.Graphics {
	const graphics = scene.add.graphics();
	const skyHeight = height * heightRatio;

	for (let i = 0; i < colors.length - 1; i++) {
		const startY = colors[i].y * skyHeight;
		const endY = colors[i + 1].y * skyHeight;
		const steps = 20;

		for (let j = 0; j < steps; j++) {
			const t = j / steps;
			const y = startY + (endY - startY) * t;
			const h = (endY - startY) / steps + 1;

			const c1 = Phaser.Display.Color.IntegerToColor(colors[i].color);
			const c2 = Phaser.Display.Color.IntegerToColor(colors[i + 1].color);
			const blended = Phaser.Display.Color.Interpolate.ColorWithColor(c1, c2, steps, j);
			const color = Phaser.Display.Color.GetColor(blended.r, blended.g, blended.b);

			graphics.fillStyle(color);
			graphics.fillRect(0, y, width, h);
		}
	}

	return graphics;
}

/**
 * Create smooth rolling hills
 */
export function createSmoothHill(
	scene: Phaser.Scene,
	width: number,
	height: number,
	color: number,
	baseY: number,
	hillHeight: number,
	offset: number
): Phaser.GameObjects.Graphics {
	const graphics = scene.add.graphics();
	graphics.fillStyle(color);
	graphics.beginPath();
	graphics.moveTo(0, height);

	const hillWidth = 300 + offset * 0.5;

	for (let x = 0; x <= width; x += 2) {
		const wave1 = Math.sin((x + offset) / hillWidth * Math.PI * 2) * hillHeight;
		const wave2 = Math.sin((x + offset * 1.5) / (hillWidth * 0.6) * Math.PI * 2) * (hillHeight * 0.4);
		const wave3 = Math.sin((x + offset * 0.7) / (hillWidth * 1.5) * Math.PI * 2) * (hillHeight * 0.6);

		const y = baseY - Math.abs(wave1 + wave2 + wave3) * 0.5;
		graphics.lineTo(x, y);
	}

	graphics.lineTo(width, height);
	graphics.closePath();
	graphics.fillPath();
	return graphics;
}

/**
 * Create layered ground with different colored strips
 */
export function createGround(
	scene: Phaser.Scene,
	width: number,
	height: number,
	colors: number[],
	topRatio: number
): Phaser.GameObjects.Graphics {
	const groundTop = height * topRatio;
	const graphics = scene.add.graphics();
	const groundHeight = height - groundTop;
	const stripHeight = groundHeight / colors.length;

	colors.forEach((color, i) => {
		graphics.fillStyle(color);
		graphics.fillRect(0, groundTop + i * stripHeight, width, stripHeight + 1);
	});

	return graphics;
}

/**
 * Create a single cloud shape
 */
export function createCloud(
	scene: Phaser.Scene,
	x: number,
	y: number,
	scale: number,
	color: number
): Phaser.GameObjects.Container {
	const cloud = scene.add.container(x, y);

	const parts = [
		{ x: 0, y: 0, r: 30 },
		{ x: -30, y: 5, r: 22 },
		{ x: 30, y: 5, r: 25 },
		{ x: -15, y: -12, r: 20 },
		{ x: 15, y: -10, r: 22 }
	];

	parts.forEach(p => {
		const circle = scene.add.circle(p.x, p.y, p.r, color, 0.9);
		cloud.add(circle);
	});

	cloud.setScale(scale);
	return cloud;
}

/**
 * Animate a cloud to move across the screen
 */
export function animateCloud(
	scene: Phaser.Scene,
	cloud: Phaser.GameObjects.Container,
	screenWidth: number,
	speed: number
): void {
	scene.tweens.add({
		targets: cloud,
		x: screenWidth + 150,
		duration: ((screenWidth + 300) / speed) * 1000,
		ease: 'Linear',
		repeat: -1,
		onRepeat: () => { cloud.x = -150; }
	});
}

/**
 * Create multiple floating clouds
 */
export function createClouds(
	scene: Phaser.Scene,
	screenWidth: number,
	color: number,
	container: Phaser.GameObjects.Container
): Phaser.GameObjects.GameObject[] {
	const configs = [
		{ x: -100, y: 60, scale: 0.7, speed: 20 },
		{ x: 200, y: 40, scale: 0.9, speed: 15 },
		{ x: 500, y: 80, scale: 0.5, speed: 25 },
		{ x: 800, y: 35, scale: 0.8, speed: 18 }
	];

	const clouds: Phaser.GameObjects.GameObject[] = [];

	configs.forEach(cfg => {
		const cloud = createCloud(scene, cfg.x, cfg.y, cfg.scale, color);
		clouds.push(cloud);
		container.add(cloud);
		animateCloud(scene, cloud, screenWidth, cfg.speed);
	});

	return clouds;
}

/**
 * Spawn a single floating particle
 */
export function spawnParticle(
	scene: Phaser.Scene,
	screenWidth: number,
	screenHeight: number,
	emojis: string[],
	randomX: boolean,
	container: Phaser.GameObjects.Container
): Phaser.GameObjects.Text {
	const x = randomX ? Phaser.Math.Between(0, screenWidth) : screenWidth + 50;
	const y = Phaser.Math.Between(50, screenHeight * 0.6);

	const particle = scene.add.text(x, y, Phaser.Utils.Array.GetRandom(emojis), {
		fontSize: `${Phaser.Math.Between(14, 24)}px`
	});
	particle.setAlpha(0.7);
	container.add(particle);

	scene.tweens.add({
		targets: particle,
		x: -100,
		y: y + Phaser.Math.Between(50, 150),
		rotation: Phaser.Math.Between(-2, 2),
		duration: Phaser.Math.Between(10000, 18000),
		ease: 'Sine.easeInOut',
		onComplete: () => {
			particle.destroy();
		}
	});

	return particle;
}

/**
 * Create floating particles system
 */
export function createFloatingParticles(
	scene: Phaser.Scene,
	screenWidth: number,
	screenHeight: number,
	emojis: string[],
	container: Phaser.GameObjects.Container
): void {
	// Initial particles
	for (let i = 0; i < 8; i++) {
		spawnParticle(scene, screenWidth, screenHeight, emojis, true, container);
	}

	// Continuous spawning
	scene.time.addEvent({
		delay: 3000,
		callback: () => spawnParticle(scene, screenWidth, screenHeight, emojis, false, container),
		loop: true
	});
}
