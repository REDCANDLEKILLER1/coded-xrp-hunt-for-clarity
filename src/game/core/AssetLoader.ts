import type { AssetDefinition, AssetDiagnostic, AssetManifest, SpriteSheetMeta } from './Types';
import { loadAssetCatalog } from './AssetCatalog';

type ResolvedAsset = {
  id: string;
  category: string;
  src: string;
  type: 'image' | 'spritesheet';
  sheet?: AssetDiagnostic['sheet'];
};

export class AssetLoader {
  manifest: AssetManifest | null = null;
  images = new Map<string, HTMLImageElement>();
  sheets = new Map<string, SpriteSheetMeta>();
  diagnostics: AssetDiagnostic[] = [];
  manifestError: string | null = null;

  async loadManifest(scene = 'flight'): Promise<void> {
    this.diagnostics = [];
    this.manifestError = null;

    try {
      this.manifest = await loadAssetCatalog();
      await this.preloadImages(scene);
      this.reportToConsole();
    } catch (error) {
      this.manifest = null;
      this.manifestError = error instanceof Error ? error.message : 'manifest load failed';
      console.warn('[CODED assets] manifest unavailable; procedural fallback active.', this.manifestError);
    }
  }

  getImage(category: string, id: string): HTMLImageElement | undefined {
    return this.images.get(`${category}:${id}`);
  }

  getSheet(category: string, id: string): SpriteSheetMeta | undefined {
    return this.sheets.get(`${category}:${id}`);
  }

  counts(): { total: number; loaded: number; missing: number; error: number } {
    return {
      total: this.diagnostics.length,
      loaded: this.diagnostics.filter((item) => item.status === 'loaded').length,
      missing: this.diagnostics.filter((item) => item.status === 'missing').length,
      error: this.diagnostics.filter((item) => item.status === 'error').length,
    };
  }

  missing(): AssetDiagnostic[] {
    return this.diagnostics.filter((item) => item.status !== 'loaded');
  }

  private async preloadImages(scene: string): Promise<void> {
    if (!this.manifest) return;
    const assets = this.flattenManifest(this.manifest, scene);
    await Promise.all(assets.map((asset) => this.loadImage(asset)));
  }

  private flattenManifest(manifest: AssetManifest, scene: string): ResolvedAsset[] {
    const assets: ResolvedAsset[] = [];

    for (const [category, entries] of Object.entries(manifest)) {
      for (const [id, definition] of Object.entries(entries)) {
        if (typeof definition !== 'string' && definition.scenes && !definition.scenes.includes(scene)) continue;
        const resolved = this.resolveDefinition(category, id, definition);
        if (resolved) assets.push(resolved);
      }
    }

    return assets;
  }

  private resolveDefinition(category: string, id: string, definition: AssetDefinition): ResolvedAsset | null {
    if (typeof definition === 'string') {
      return { id, category, src: definition, type: 'image' };
    }

    if (definition?.type === 'model' || definition?.type === 'audio') return null;

    if (!definition?.src) {
      this.diagnostics.push({ id, category, src: '', status: 'error', type: 'image' });
      return null;
    }

    return {
      id,
      category,
      src: definition.src,
      type: definition.type ?? 'image',
      sheet: definition.sheet,
    };
  }

  private loadImage(asset: ResolvedAsset): Promise<void> {
    return new Promise((resolve) => {
      const key = `${asset.category}:${asset.id}`;
      const image = new Image();

      image.onload = () => {
        this.images.set(key, image);
        if (asset.type === 'spritesheet' && asset.sheet) this.sheets.set(key, asset.sheet);
        this.diagnostics.push({ ...asset, status: 'loaded' });
        resolve();
      };

      image.onerror = () => {
        this.diagnostics.push({ ...asset, status: 'missing' });
        resolve();
      };

      image.src = asset.src;
    });
  }

  private reportToConsole(): void {
    const counts = this.counts();
    console.info('[CODED assets]', counts);
    if (counts.missing || counts.error) {
      console.table(this.missing().map(({ category, id, src, status, type }) => ({ category, id, src, status, type })));
    }
  }
}
