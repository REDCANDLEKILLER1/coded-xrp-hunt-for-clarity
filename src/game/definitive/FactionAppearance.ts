import type { Mesh, MeshStandardMaterial, Object3D } from 'three';

export const LIQUIDITY_GREEN = '#00FF00';
export const HOSTILE_RED = '#FF0000';

/** Only the captured capital ship receives this livery. Crew uniforms retain
 * their canon colors: TruFi and Blue Umbrella are allies, not hostile factions. */
export function applyCapturedLivery(root: Object3D): void {
  root.userData.allegiance = 'friendly';
  root.traverse(object => {
    if (!(object as Mesh).isMesh) return;
    const source = (object as Mesh).material;
    for (const material of Array.isArray(source) ? source : [source]) {
      const m = material as MeshStandardMaterial;
      if (!m.isMeshStandardMaterial) continue;
      if (m.name === 'Armor_Plane') {
        m.color.set('#00A800'); m.metalness = .55;
        m.emissive.set(LIQUIDITY_GREEN); m.emissiveIntensity = .075;
      } else if (m.name === 'Armor_Gunmetal') {
        m.color.set('#285232');
      } else if (/Hostile|Engine/.test(m.name)) {
        m.color.set(LIQUIDITY_GREEN); m.emissive.set(LIQUIDITY_GREEN);
        m.emissiveIntensity = 1; m.toneMapped = false;
      }
    }
  });
}
