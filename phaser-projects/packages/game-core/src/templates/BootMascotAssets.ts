import { resolvePreviewPath } from '../previewRuntime';

export interface BootMascotAsset {
	key: string;
	url: string;
}

const bootMascotAssets: BootMascotAsset[] = [
	{ key: 'guapen', url: '/assets/shared/mascots/guapen.png' },
	{ key: 'FufuSuperDino', url: '/assets/shared/mascots/FufuSuperDino.png' },
	// The default theme still asks for mascot-owl, but no owl blob is checked in yet.
	// Alias it to the stable shared mascot path instead of loading a removed Activity-local placeholder.
	{ key: 'mascot-owl', url: '/assets/shared/mascots/guapen.png' }
];

export function getBootMascotAssets(): BootMascotAsset[] {
	return bootMascotAssets.map((asset) => ({
		...asset,
		url: resolvePreviewPath(asset.url),
	}));
}
