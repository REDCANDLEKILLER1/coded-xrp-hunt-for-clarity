import type { AssetManifest } from '../core/Types';

export interface TrackDef { src: string; title: string; loop: boolean; gain: number; }
export interface MusicConfig { tracks: Record<string, Omit<TrackDef, 'src'>>; cues: Record<string, string | null>; }
export interface AudioManifest { tracks: Record<string, TrackDef>; cues: Record<string, string | null>; }

/** The music file supplies cue/gain settings; all asset paths come from the catalog. */
export function resolveMusicCatalog(config: MusicConfig, assets: AssetManifest): AudioManifest {
  const tracks: Record<string, TrackDef> = {};
  for (const [key, settings] of Object.entries(config.tracks)) {
    const asset = assets.audio?.[key];
    if (!asset || typeof asset === 'string' || asset.type !== 'audio') throw new Error(`Audio is not registered: ${key}`);
    if (typeof settings.title !== 'string' || typeof settings.loop !== 'boolean' || !(settings.gain > 0 && settings.gain <= 1)) throw new Error(`Invalid music settings: ${key}`);
    tracks[key] = { ...settings, src: asset.src };
  }
  for (const key of Object.keys(assets.audio ?? {})) if (!tracks[key]) throw new Error(`Audio lacks a music consumer: ${key}`);
  for (const [cue, key] of Object.entries(config.cues)) if (key !== null && !tracks[key]) throw new Error(`Music cue is unresolved: ${cue}`);
  return { tracks, cues: { ...config.cues } };
}
