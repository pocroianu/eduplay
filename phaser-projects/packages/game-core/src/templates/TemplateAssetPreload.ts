import AssetResolver from '../services/AssetResolver';
import type { ResolvedAsset } from '../types/AssetSchema';

function uniqueKeys(keys: readonly (string | undefined)[]): string[] {
	return Array.from(new Set(keys.filter((key): key is string => Boolean(key))));
}

export async function resolveTemplateImageAssets(imageKeys: readonly (string | undefined)[]): Promise<ResolvedAsset[]> {
	const keys = uniqueKeys(imageKeys);
	if (keys.length === 0) return [];

	const assets = await AssetResolver.getInstance().resolveAssets({
		images: keys,
		audio: [],
		spritesheets: []
	});

	return assets.filter((asset) => asset.type === 'image');
}

export async function resolveTemplateAudioAssets(audioKeys: readonly (string | undefined)[]): Promise<ResolvedAsset[]> {
	const keys = uniqueKeys(audioKeys);
	if (keys.length === 0) return [];

	const assets = await AssetResolver.getInstance().resolveAssets({
		images: [],
		audio: keys,
		spritesheets: []
	});

	return assets.filter((asset) => asset.type === 'audio');
}
