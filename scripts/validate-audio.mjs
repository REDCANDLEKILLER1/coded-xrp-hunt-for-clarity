// Music wiring.
//
// The game dispatched `coded:music-cue` from every scene change long before
// anything listened to them, so the whole campaign played silent. This checks
// that the cues the game actually fires all resolve to a real track file, and
// that the director keeps the properties the platform forces on it.

import { readFileSync, statSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { build } from 'esbuild';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const config = JSON.parse(readFileSync('public/assets/audio/manifest.json', 'utf8'));
const assets = JSON.parse(readFileSync('public/assets/manifest.json', 'utf8'));
const compiled = await build({ entryPoints: ['src/game/audio/MusicCatalog.ts'], bundle: true, format: 'esm', write: false, logLevel: 'silent' });
const { resolveMusicCatalog } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const manifest = resolveMusicCatalog(config, assets);
const director = readFileSync('src/game/audio/MusicDirector.ts', 'utf8');
const main = readFileSync('src/main.ts', 'utf8');
const game2a = readFileSync('src/game/core/Game2A.ts', 'utf8');
const onFoot = readFileSync('src/game/onfoot/OnFootGame.ts', 'utf8');
const styles = readFileSync('src/style.css', 'utf8');

// ---- every declared track is a real, non-trivial file ---------------------
for (const [key, def] of Object.entries(manifest.tracks)) {
  check(typeof def.src === 'string' && def.src.startsWith('/assets/audio/'), `tracks.${key}: src must live under /assets/audio/`);
  const path = `public${def.src}`;
  let size = 0;
  try { size = statSync(path).size; } catch { /* reported below */ }
  check(size > 100_000, `tracks.${key}: ${path} is missing or truncated (${size} bytes)`);
  check(def.gain > 0 && def.gain <= 1, `tracks.${key}: gain must be in (0, 1]`);
  check(typeof def.title === 'string' && def.title.length > 0, `tracks.${key}: title is empty`);

  // A real MP3, not a renamed something-else. Either an ID3 tag or a frame sync.
  const head = readFileSync(path).subarray(0, 4);
  const isMp3 = head.subarray(0, 3).toString('latin1') === 'ID3' || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0);
  check(isMp3, `tracks.${key}: ${path} is not an MP3 (no ID3 tag and no frame sync)`);
}

// ---- no orphan audio files, and no cue pointing at nothing -----------------
const onDisk = readdirSync('public/assets/audio').filter((name) => name.endsWith('.mp3'));
const referenced = new Set(Object.values(manifest.tracks).map((def) => def.src.split('/').pop()));
for (const file of onDisk) {
  check(referenced.has(file), `public/assets/audio/${file} is an orphan: no manifest track references it`);
}

for (const [cue, trackKey] of Object.entries(manifest.cues)) {
  if (trackKey === null) continue;
  check(trackKey in manifest.tracks, `cues.${cue} points at unknown track "${trackKey}"`);
}

// ---- every cue the game actually fires is mapped --------------------------
const fired = new Set();
for (const source of [game2a, onFoot, main]) {
  for (const match of source.matchAll(/cueMusic\('([a-z0-9_]+)'\)/g)) fired.add(match[1]);
  for (const match of source.matchAll(/cue: '([a-z0-9_]+)' \}/g)) fired.add(match[1]);
  for (const match of source.matchAll(/music\.cue\('([a-z0-9_]+)'\)/g)) fired.add(match[1]);
}
// Gary Fog's cue key lives in content, not as a literal at the call site.
fired.add(readFileSync('src/game/content/EarthBossFlow.ts', 'utf8').match(/musicCueKey: '([a-z0-9_]+)'/)[1]);
// 'resume' is handled inside the director, not by the cue table.
fired.delete('resume');

check(fired.size > 0, 'no music cues found in the game sources — the scraper is broken');
for (const cue of fired) {
  check(cue in manifest.cues, `the game fires cue "${cue}" but the audio manifest does not map it`);
}

// ---- the constraints the platform forces on us ----------------------------
// Autoplay is blocked until a gesture, so a cue fired at boot must be held.
check(/pendingCue/.test(director), 'director must hold a cue fired before the first gesture');
check(/pointerdown/.test(director) && /unlocked/.test(director), 'director must unlock playback on a user gesture');
// Tracks are 3.5-4.4 MB each; booting must not download them.
check(/preload = 'none'/.test(director), 'tracks must not preload — they are several MB each');
// The game re-cues the same track on every act change.
check(/if \(trackKey === this\.currentTrack\) return;/.test(director), 're-cueing the playing track must be a no-op, or music restarts constantly');
check(/loop = def\.loop/.test(director), 'looping must come from the manifest');

// Owner-approved typed catalog: a single path declaration, with lazy audio decode.
check(!/\.mp3/.test(JSON.stringify(config)), 'music settings must not duplicate the authoritative asset paths');
for (const key of Object.keys(manifest.tracks)) check(assets.audio[key]?.type === 'audio', `audio.${key} needs its explicit type`);
for (const mutated of [
  { ...assets, audio: { ...assets.audio, theme: { ...assets.audio.theme, type: 'image' } } },
  { ...assets, audio: { ...assets.audio, orphan: { type: 'audio', src: '/assets/audio/orphan.mp3' } } },
]) {
  let rejected = false;
  try { resolveMusicCatalog(config, mutated); } catch { rejected = true; }
  check(rejected, 'the actual resolver must reject mistyped or unconsumed audio');
}

// The theme carries the title screen and the pause menu.
check(/music\.cue\('theme'\)/.test(main), 'the theme must be cued for the title/campaign screen');
check(/cueMusic\(paused \? 'paused' : 'resume'\)/.test(game2a), 'pausing must cue the theme and unpausing must restore the mission track');
check(manifest.cues.paused === 'theme', 'the pause menu must play the theme');

// Music that cannot be turned off is a bug on a phone.
check(/setMuted/.test(director) && /music-toggle/.test(main), 'there must be a mute control');
check(/\.music-toggle/.test(styles), 'mute control has no styles');

if (failures.length) {
  console.error('audio: FAIL');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`audio: OK — ${Object.keys(manifest.tracks).length} tracks, ${fired.size} live cues, all mapped.`);
