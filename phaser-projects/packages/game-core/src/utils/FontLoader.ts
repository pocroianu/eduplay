/**
 * Load a Google Font via @font-face injection.
 * Returns a Promise that resolves when the font is ready to render.
 */
export function loadGoogleFont(
	fontFamily: string,
	weights: number[] = [400, 600, 700, 800, 900]
): Promise<void> {
	const weightsStr = weights.join(';');
	const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@${weightsStr}&display=swap`;

	const link = document.createElement('link');
	link.rel = 'stylesheet';
	link.href = url;
	document.head.appendChild(link);

	if (document.fonts && document.fonts.ready) {
		return document.fonts.ready.then(() => {
			const loaded = Array.from(document.fonts).some(
				(f) => f.family.replace(/['"]/g, '') === fontFamily && f.status === 'loaded'
			);
			if (!loaded) {
				console.warn(`Font "${fontFamily}" may not have loaded correctly, falling back.`);
			}
		});
	}

	return new Promise((resolve) => {
		link.onload = () => resolve();
		link.onerror = () => {
			console.warn(`Failed to load font "${fontFamily}", falling back to system fonts.`);
			resolve();
		};
	});
}

/** The primary font family string to use in Phaser text styles */
export const GAME_FONT = "'Nunito', 'Nunito Sans', Arial, sans-serif";

/** Font weights used in the game */
export const FONT_WEIGHTS = {
	regular: '400',
	semibold: '600',
	bold: '700',
	extrabold: '800',
	black: '900',
} as const;
