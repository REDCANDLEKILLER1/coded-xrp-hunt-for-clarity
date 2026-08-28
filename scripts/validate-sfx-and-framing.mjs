// Sound effects, music lead-in, and boss framing.
//
// Playtest: "We're definitely going to need Video Game noises explosions and
// shooting noises", "if you make it come on before it starts and let it play
// for about 5 seconds", "make the boss fight enemy ship come in at the top of
// the screen stop further up so you're not so crowded on the bottom", "make
// our little ship even a little smaller", "more room where the enemy ship can
// move around".

import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

// ---- behavioural: cinematic timings and hull sizes -------------------------
const bundle = await build({
  entryPoints: ['src/game/content/Level1Cinematics.ts', 'src/game/content/registry.ts'],
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'silent',
  outdir: 'out',
});
const load = async (name) => {
  const file = bundle.outputFiles.find((f) => f.path.endsWith(`${name}.js`));
  return import(`data:text/javascript;base64,${Buffer.from(file.text).toString('base64')}`);
};

const cine = await load('Level1Cinematics');
const cineErrors = cine.validateLevel1Cinematics();
check(cineErrors.length === 0, `cinematics do not validate: ${cineErrors.join('; ')}`);
check(cine.EARTH_LAUNCH_REVEAL.musicLead >= 4, `the level theme must lead the launch; musicLead is ${cine.EARTH_LAUNCH_REVEAL.musicLead}s`);
check(cine.GARY_FOG_REVEAL.musicLead >= 5, `boss music must lead the reveal; musicLead is ${cine.GARY_FOG_REVEAL.musicLead}s`);
// The lead is only real if the entrance actually waits for it.
const total = cine.revealTotalDuration(cine.EARTH_LAUNCH_REVEAL);
check(total > cine.EARTH_LAUNCH_REVEAL.musicLead, 'the launch reveal must outlast its own music lead');

const { SHIPS } = await load('registry');
for (const ship of Object.values(SHIPS)) {
  // The fighter shrank twice on playtest feedback. On a 274px-tall landscape
  // phone anything taller than this eats the arena.
  check(ship.draw.h <= 34, `ships.${ship.key}: draw height ${ship.draw.h} is too tall for a landscape phone`);
  check(ship.hitbox.w <= ship.draw.w && ship.hitbox.h <= ship.draw.h, `ships.${ship.key}: hitbox must not exceed the sprite`);
}

// ---- every cue the game fires is still mapped ------------------------------
const audio = JSON.parse(readFileSync('public/assets/audio/manifest.json', 'utf8'));
check(audio.cues.boss_fight === 'boss_fight', 'arcade bosses must cue the boss track — they used to arrive in silence');

// ---- sound effects are synthesised, lazy and mutable ----------------------
const sfx = readFileSync('src/game/audio/Sfx.ts', 'utf8');
check(!/\.(mp3|ogg|wav)/.test(sfx), 'effects must be synthesised, not loaded — the music already costs 11MB');
check(/createOscillator\(\)/.test(sfx) && /createBufferSource\(\)/.test(sfx), 'effects need both tones and noise');
// Autoplay policy: no AudioContext may exist before a gesture.
check(/private context\(\): AudioContext \| null \{\n    if \(this\.ctx\) return this\.ctx;/.test(sfx), 'the audio context must be created lazily on first use');
check(/MIN_GAP_MS/.test(sfx), 'rapid-fire effects need a throttle or they become a wall of noise');
check(/setMuted\(muted: boolean\)/.test(sfx), 'effects must be mutable');
check(/localStorage\.setItem\(MUTE_STORAGE_KEY/.test(sfx), 'the mute setting must survive a reload');

const main = readFileSync('src/main.ts', 'utf8');
check(/sfx\.setMuted\(next\)/.test(main), 'the sound toggle must mute effects as well as music');
check(/sfx\.setMuted\(music\.isMuted\)/.test(main), 'effects must start muted if the player left sound off');

// ---- the game actually makes noise ---------------------------------------
const game = readFileSync('src/game/core/Game2A.ts', 'utf8');
for (const [voice, why] of [
  ["'shoot'", 'the player gun'],
  ["'enemyShoot'", 'enemy fire'],
  ["'explode'", 'a destroyed enemy'],
  ["'bigExplode'", 'a destroyed boss'],
  ["'hurt'", 'taking a hit'],
  ["'pickup'", 'collecting a pickup'],
  ["'bomb'", 'the bomb'],
  ["'pulse'", 'the pulse'],
  ["'levelUp'", 'levelling up'],
  ["'deny'", 'pressing a button with nothing to spend'],
]) {
  check(new RegExp(`sfx\\.play\\(${voice}`).test(game), `no sound for ${why}`);
}

// ---- boss framing is proportional, not pinned to a tall screen -------------
check(!/boss\.y = 112 \+/.test(game) && !/boss\.y = 118;/.test(game), 'boss height must not be a fixed pixel value');
const rest = game.match(/private bossRestY\(\): number \{\s*return clamp\(this\.h \* ([\d.]+), (\d+), (\d+)\);/);
check(!!rest, 'bossRestY must clamp a proportion of the screen height');
if (rest) {
  const [, factor, lo] = rest;
  // On the reported 274px landscape phone the boss has to sit in the top
  // third, or it crowds the fighter against the bottom edge.
  const restOn274 = Math.min(Math.max(274 * Number(factor), Number(lo)), 274);
  check(restOn274 < 274 * 0.35, `boss rests at y=${restOn274.toFixed(0)} on a 274px screen — that is not "further up"`);
}
check(/private bossDriftY\(\): number/.test(game), 'the boss needs a drift band that scales with the screen');
check(/boss\.targetX = 52 \+ Math\.random\(\) \* Math\.max\(1, this\.w - 104\)/.test(game), 'the boss must sweep nearly the full width, not a narrow middle band');

if (failures.length) {
  console.error('sfx-and-framing: FAIL');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('sfx-and-framing: OK — synthesised effects, music leads both entrances, boss framed high with room to roam.');
