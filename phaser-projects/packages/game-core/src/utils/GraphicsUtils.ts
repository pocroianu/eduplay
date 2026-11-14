import Phaser from 'phaser';

/**
 * Draw a rounded rectangle with optional bottom shadow (3D button effect).
 */
export function drawRoundedRect(
	graphics: Phaser.GameObjects.Graphics,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number,
	options: {
		fillColor: number;
		fillAlpha?: number;
		strokeColor?: number;
		strokeWidth?: number;
		shadowColor?: number;
		shadowOffset?: number;
	}
): void {
	const { fillColor, fillAlpha = 1, strokeColor, strokeWidth = 0, shadowColor, shadowOffset = 6 } = options;

	if (shadowColor !== undefined) {
		graphics.fillStyle(shadowColor, 1);
		graphics.fillRoundedRect(x, y + shadowOffset, width, height, radius);
	}

	graphics.fillStyle(fillColor, fillAlpha);
	graphics.fillRoundedRect(x, y, width, height, radius);

	if (strokeColor !== undefined && strokeWidth > 0) {
		graphics.lineStyle(strokeWidth, strokeColor, 1);
		graphics.strokeRoundedRect(x, y, width, height, radius);
	}
}

/**
 * Draw a 5-point star shape.
 */
export function drawStar(
	graphics: Phaser.GameObjects.Graphics,
	cx: number,
	cy: number,
	outerRadius: number,
	options: {
		fillColor: number;
		strokeColor?: number;
		strokeWidth?: number;
		innerRadiusRatio?: number;
	}
): void {
	const { fillColor, strokeColor, strokeWidth = 0, innerRadiusRatio = 0.4 } = options;
	const innerRadius = outerRadius * innerRadiusRatio;
	const points: number[] = [];
	const numPoints = 5;

	for (let i = 0; i < numPoints * 2; i++) {
		const angle = (i * Math.PI) / numPoints - Math.PI / 2;
		const radius = i % 2 === 0 ? outerRadius : innerRadius;
		points.push(cx + Math.cos(angle) * radius);
		points.push(cy + Math.sin(angle) * radius);
	}

	graphics.fillStyle(fillColor, 1);
	graphics.beginPath();
	graphics.moveTo(points[0], points[1]);
	for (let i = 2; i < points.length; i += 2) {
		graphics.lineTo(points[i], points[i + 1]);
	}
	graphics.closePath();
	graphics.fillPath();

	if (strokeColor !== undefined && strokeWidth > 0) {
		graphics.lineStyle(strokeWidth, strokeColor, 1);
		graphics.beginPath();
		graphics.moveTo(points[0], points[1]);
		for (let i = 2; i < points.length; i += 2) {
			graphics.lineTo(points[i], points[i + 1]);
		}
		graphics.closePath();
		graphics.strokePath();
	}
}

/**
 * Draw a circular badge with a checkmark (for correct answers).
 */
export function drawCheckBadge(
	graphics: Phaser.GameObjects.Graphics,
	cx: number,
	cy: number,
	radius: number,
	options: {
		bgColor?: number;
		checkColor?: number;
	} = {}
): void {
	const { bgColor = 0x4CAF50, checkColor = 0xFFFFFF } = options;

	graphics.fillStyle(bgColor, 1);
	graphics.fillCircle(cx, cy, radius);

	graphics.lineStyle(3, checkColor, 1);
	graphics.beginPath();
	graphics.moveTo(cx - radius * 0.35, cy);
	graphics.lineTo(cx - radius * 0.05, cy + radius * 0.3);
	graphics.lineTo(cx + radius * 0.4, cy - radius * 0.3);
	graphics.strokePath();
}

/**
 * Draw a circular badge with an X mark (for incorrect answers).
 */
export function drawCrossBadge(
	graphics: Phaser.GameObjects.Graphics,
	cx: number,
	cy: number,
	radius: number,
	options: {
		bgColor?: number;
		crossColor?: number;
	} = {}
): void {
	const { bgColor = 0xE53935, crossColor = 0xFFFFFF } = options;

	graphics.fillStyle(bgColor, 1);
	graphics.fillCircle(cx, cy, radius);

	const offset = radius * 0.3;
	graphics.lineStyle(3, crossColor, 1);
	graphics.beginPath();
	graphics.moveTo(cx - offset, cy - offset);
	graphics.lineTo(cx + offset, cy + offset);
	graphics.strokePath();
	graphics.beginPath();
	graphics.moveTo(cx + offset, cy - offset);
	graphics.lineTo(cx - offset, cy + offset);
	graphics.strokePath();
}

/**
 * Draw a speaker icon (for audio buttons).
 */
export function drawSpeakerIcon(
	graphics: Phaser.GameObjects.Graphics,
	cx: number,
	cy: number,
	size: number,
	color: number = 0xFFFFFF
): void {
	graphics.fillStyle(color, 1);

	const bodyW = size * 0.2;
	const bodyH = size * 0.3;
	graphics.fillRect(cx - size * 0.3, cy - bodyH / 2, bodyW, bodyH);

	graphics.fillTriangle(
		cx - size * 0.1, cy - bodyH / 2,
		cx - size * 0.1, cy + bodyH / 2,
		cx + size * 0.1, cy
	);

	graphics.lineStyle(2, color, 1);
	graphics.beginPath();
	graphics.arc(cx + size * 0.1, cy, size * 0.2, -Math.PI / 3, Math.PI / 3);
	graphics.strokePath();
	graphics.beginPath();
	graphics.arc(cx + size * 0.1, cy, size * 0.35, -Math.PI / 4, Math.PI / 4);
	graphics.strokePath();
}

/**
 * Draw a repeat/replay icon (circular arrow).
 */
export function drawRepeatIcon(
	graphics: Phaser.GameObjects.Graphics,
	cx: number,
	cy: number,
	size: number,
	color: number = 0xFFFFFF
): void {
	const radius = size * 0.35;

	graphics.lineStyle(3, color, 1);
	graphics.beginPath();
	graphics.arc(cx, cy, radius, -Math.PI * 0.8, Math.PI * 0.6);
	graphics.strokePath();

	const arrowX = cx + Math.cos(Math.PI * 0.6) * radius;
	const arrowY = cy + Math.sin(Math.PI * 0.6) * radius;
	graphics.fillStyle(color, 1);
	graphics.fillTriangle(
		arrowX - 4, arrowY - 6,
		arrowX + 6, arrowY,
		arrowX - 4, arrowY + 6
	);
}

/**
 * Draw a pause icon (two vertical bars).
 */
export function drawPauseIcon(
	graphics: Phaser.GameObjects.Graphics,
	cx: number,
	cy: number,
	size: number,
	color: number = 0xFFFFFF
): void {
	const barWidth = size * 0.15;
	const barHeight = size * 0.5;
	const gap = size * 0.12;

	graphics.fillStyle(color, 1);
	graphics.fillRect(cx - gap - barWidth, cy - barHeight / 2, barWidth, barHeight);
	graphics.fillRect(cx + gap, cy - barHeight / 2, barWidth, barHeight);
}

/**
 * Draw a play icon (triangle pointing right).
 */
export function drawPlayIcon(
	graphics: Phaser.GameObjects.Graphics,
	cx: number,
	cy: number,
	size: number,
	color: number = 0xFFFFFF
): void {
	const half = size * 0.25;
	graphics.fillStyle(color, 1);
	graphics.fillTriangle(
		cx - half, cy - half,
		cx - half, cy + half,
		cx + half, cy
	);
}
