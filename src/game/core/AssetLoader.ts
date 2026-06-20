import type { AssetManifest } from './Types';

export class AssetLoader {
  manifest: AssetManifest | null = null;
  images = new Map<string, HTMLImageElement>();

  async loadManifest(): Promise<void> {
    try {
      const response = await fetch('/assets/manifest.json');
      if (!response.ok) throw new Error('manifest not found');
      this.manifest = await response.json() as AssetManifest;
      await this.preloadImages();
    } catch {
      this.manifest = null;
    }
  }

  private async preloadImages(): Promise<void> {
    if (!this.manifest) return;
    const paths = Object.values(this.manifest).flatMap((category) => Object.entries(category));
    await Promise.all(paths.map(([key, path]) => this.loadImage(key, path)));
  }

  private loadImage(key: string, path: string): Promise<void> {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => { this.images.set(key, image); resolve(); };
      image.onerror = () => resolve();
      image.src = path;
    });
  }
}
