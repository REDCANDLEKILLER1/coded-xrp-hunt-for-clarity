import type { AssetManifest } from './Types';

let request: Promise<AssetManifest> | null = null;

/** One source of asset paths; scene loaders choose how and when each type decodes. */
export function loadAssetCatalog(): Promise<AssetManifest> {
  request ??= fetch('/assets/manifest.json', { cache: 'no-store' }).then(async (response) => {
    if (!response.ok) throw new Error(`asset registry HTTP ${response.status}`);
    const manifest = await response.json() as AssetManifest;
    for (const entries of Object.values(manifest)) {
      for (const entry of Object.values(entries)) {
        const src = typeof entry === 'string' ? entry : entry.src;
        if (!src.startsWith('/assets/') || src.includes('..')) throw new Error('Asset path must remain inside the runtime catalog');
        if (typeof entry !== 'string' && !['image', 'spritesheet', 'model', 'audio'].includes(entry.type ?? 'image')) throw new Error('Unknown runtime asset type');
      }
    }
    return manifest;
  }).catch((error) => { request = null; throw error; });
  return request;
}
