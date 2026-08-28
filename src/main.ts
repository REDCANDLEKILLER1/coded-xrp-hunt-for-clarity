import './style.css';
import { watchForUpdates } from './game/core/UpdateWatch';
import './landscape.css';
import { Game2A } from './game/core/Game2A';
import { CampaignMap } from './game/ui/CampaignMap';
import { DirectBoardingRuntime } from './game/ui/DirectBoardingRuntime';
import { LandscapeMode } from './game/ui/LandscapeMode';
import { OnFootGame } from './game/onfoot/OnFootGame';
import { debugLog } from './game/core/DebugLog';
import { MusicDirector } from './game/audio/MusicDirector';
import { sfx } from './game/audio/Sfx';
import { showDebugLogView } from './game/ui/DebugLogView';
import {
  loadCampaignProgress,
  missionCheckpointFor,
  recordMissionCheckpoint,
  saveCampaignProgress,
  type MissionCheckpointSnapshot,
} from './game/content/CampaignProgress';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
const campaignRoot = document.querySelector<HTMLElement>('#campaign-map');
const gameShell = document.querySelector<HTMLElement>('#game-shell');
const returnMap = document.querySelector<HTMLButtonElement>('#return-map');

if (!canvas || !campaignRoot || !gameShell || !returnMap) {
  throw new Error('Required campaign UI was not found.');
}

debugLog.restore();
debugLog.log('boot', 'startup', {
  url: location.pathname + location.search,
  viewport: `${innerWidth}x${innerHeight}`,
  dpr: devicePixelRatio,
  orientation: screen.orientation?.angle ?? 'n/a',
  coarsePointer: matchMedia('(pointer: coarse)').matches,
});

// `?log` still works, but the log is primarily reached from an in-app button so
// nobody has to type a URL on a phone.
if (new URLSearchParams(location.search).has('log')) {
  showDebugLogView();
}

// Nothing was listening to the `coded:music-cue` events the game has been
// dispatching all along, so the campaign played silent. The director listens,
// and the theme is cued immediately -- it will sit pending until the player's
// first gesture, which autoplay policy requires before anything can be heard.
const music = new MusicDirector();
music.cue('theme');

const muteButton = document.createElement('button');
muteButton.type = 'button';
muteButton.className = 'music-toggle';
// One switch for music and effects: two separate audio toggles on a phone HUD
// is more chrome than the screen can spare.
const paintMute = (): void => {
  const off = music.isMuted;
  muteButton.textContent = off ? '♪ OFF' : '♪ ON';
  muteButton.setAttribute('aria-pressed', String(off));
  muteButton.title = off ? 'Turn sound on' : 'Turn sound off';
};
muteButton.addEventListener('click', (event) => {
  event.stopPropagation();
  const next = !music.isMuted;
  music.setMuted(next);
  sfx.setMuted(next);
  paintMute();
});
sfx.setMuted(music.isMuted);
paintMute();
document.body.appendChild(muteButton);

const logButton = document.createElement('button');
logButton.type = 'button';
logButton.className = 'debug-log-button';
logButton.textContent = 'LOG';
logButton.title = 'Open the on-device debug log';
logButton.setAttribute('aria-label', 'Open debug log');
logButton.addEventListener('click', (event) => {
  event.stopPropagation();
  showDebugLogView();
});
document.body.appendChild(logButton);

new LandscapeMode();
const game = new Game2A(canvas);
const boarding = new DirectBoardingRuntime(game, gameShell);
const onFoot = new OnFootGame(gameShell);
let map: CampaignMap;
map = new CampaignMap(
  campaignRoot,
  (planet, checkpoint?: MissionCheckpointSnapshot) => {
    onFoot.hide();
    canvas.style.visibility = 'visible';
    map.hide();
    gameShell.hidden = false;
    debugLog.log('mission', 'deploy from map', {
      planet: planet.key,
      label: planet.label,
      resumeAct: checkpoint?.resumeActKey ?? null,
    });
    // Clear the boarding bridge BEFORE the restore rebuilds a disabled warship.
    boarding.resetForRetry();
    game.deployFromMap(planet.key, planet.label, checkpoint);
  },
  () => {
    onFoot.hide();
    canvas.style.visibility = 'visible';
    map.hide();
    gameShell.hidden = false;
    game.deployTestMode();
  },
);

/** Where the stored checkpoint says the interior run had reached. */
function savedInteriorRoom(): number {
  return missionCheckpointFor(loadCampaignProgress(), 'ledger_prime')?.interiorRoom ?? 0;
}

window.addEventListener('coded:boarding-complete', () => {
  debugLog.log('mission', 'boarding complete -> on foot');
  canvas.style.visibility = 'hidden';
  onFoot.show(savedInteriorRoom());
});

// Clearing a room is a save point of its own. The act checkpoint stays at the
// boarding lock; this just records how far in the run got, so a defeat does not
// cost every room already taken.
window.addEventListener('coded:onfoot-room', (event) => {
  const room = Number((event as CustomEvent<{ room: number }>).detail?.room ?? 0);
  const progress = loadCampaignProgress();
  const checkpoint = missionCheckpointFor(progress, 'ledger_prime');
  if (!checkpoint || !Number.isFinite(room)) return;
  debugLog.log('mission', 'interior checkpoint', { room });
  saveCampaignProgress(recordMissionCheckpoint(progress, { ...checkpoint, interiorRoom: room }));
});

window.addEventListener('coded:onfoot-defeat', () => {
  debugLog.log('mission', 'on-foot defeat -> checkpoint restore');
  canvas.style.visibility = 'visible';
  const checkpoint = missionCheckpointFor(loadCampaignProgress(), 'ledger_prime');
  if (checkpoint) {
    // The restore rebuilds the disabled warship synchronously, so the frame loop
    // never sees a frame without one. Re-arm the boarding bridge explicitly.
    boarding.resetForRetry();
    game.deployFromMap('ledger_prime', 'EARTH — LEDGER PRIME', checkpoint);
    return;
  }
  gameShell.hidden = true;
  map.show();
  music.cue('theme');
});

returnMap.addEventListener('click', () => {
  onFoot.hide();
  canvas.style.visibility = 'visible';
  game.suspend();
  gameShell.hidden = true;
  map.show();
  music.cue('theme');
});

// A deploy used to reach nobody already playing. This restarts them into it.
watchForUpdates(import.meta.url);

void game.start().then(() => {
  const params = new URLSearchParams(location.search);

  // Dedicated phone playtest route. It bypasses the title/campaign shell and starts the
  // existing arcade fighter loop without changing its movement, firing, or collision rules.
  if (params.has('flight')) {
    map.hide();
    onFoot.hide();
    gameShell.hidden = false;
    canvas.style.visibility = 'visible';
    game.deployTestMode();
    const flightTest = game as unknown as { reset: () => void };
    flightTest.reset();
    return;
  }

  if (!params.has('onfoot')) return;
  map.hide();
  game.suspend();
  gameShell.hidden = false;
  canvas.style.visibility = 'hidden';
  // Honours the saved room like every other way in, and ?room= overrides it
  // for testing a single room without walking the warship to reach it.
  const room = params.has('room') ? Number(params.get('room')) : savedInteriorRoom();
  onFoot.show(Number.isFinite(room) ? room : 0);
});
