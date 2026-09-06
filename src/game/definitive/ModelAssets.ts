import { BufferGeometry, Material, Object3D, Skeleton, Texture } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { loadAssetCatalog } from '../core/AssetCatalog';

export async function loadModel(id: string, signal: AbortSignal): Promise<GLTF> {
  const manifest = await loadAssetCatalog();
  const entry = manifest.models?.[id];
  if (!entry || typeof entry === 'string' || entry.type !== 'model' || !/^\/assets\/models\/[a-z0-9_/-]+\.glb$/.test(entry.src)) throw new Error(`Model is not registered: ${id}`);
  const file = await fetch(entry.src, { signal });
  if (!file.ok) throw new Error(`Model unavailable (${file.status})`);
  const bytes = await file.arrayBuffer();
  if (entry.bytes !== bytes.byteLength) throw new Error(`Model download is incomplete: ${id}`);
  const gltf = await new GLTFLoader().parseAsync(bytes, entry.src.slice(0, entry.src.lastIndexOf('/') + 1));
  if (signal.aborted) { disposeObject(gltf.scene); throw new DOMException('Scene load cancelled', 'AbortError'); }
  return gltf;
}

/** Parallel scene loads release successful siblings if any required model fails. */
export async function loadModels(ids: readonly string[], signal: AbortSignal): Promise<GLTF[]> {
  const results=await Promise.allSettled(ids.map(id=>loadModel(id,signal)));
  const failure=results.find((result):result is PromiseRejectedResult=>result.status==='rejected');
  if(failure){for(const result of results)if(result.status==='fulfilled')disposeObject(result.value.scene);throw failure.reason;}
  return results.map(result=>(result as PromiseFulfilledResult<GLTF>).value);
}

/** Dispose shared geometry/material/texture references once per scene tree. */
export function disposeObject(root: Object3D): void {
  const resources = new Set<BufferGeometry | Material | Texture>();
  const skeletons = new Set<Skeleton>();
  root.traverse((object) => {
    const drawable = object as Object3D & { geometry?: BufferGeometry; material?: Material | Material[]; skeleton?: Skeleton };
    if (drawable.skeleton) skeletons.add(drawable.skeleton);
    if (drawable.geometry) resources.add(drawable.geometry);
    for (const material of drawable.material ? Array.isArray(drawable.material) ? drawable.material : [drawable.material] : []) {
      resources.add(material);
      for (const value of Object.values(material)) if (value instanceof Texture) resources.add(value);
    }
  });
  for (const skeleton of skeletons) skeleton.dispose();
  for (const resource of resources) {
    resource.dispose();
    if (resource instanceof Texture) {
      const image = resource.source?.data as { close?: () => void } | undefined;
      if (typeof image?.close === 'function') image.close();
    }
  }
}
