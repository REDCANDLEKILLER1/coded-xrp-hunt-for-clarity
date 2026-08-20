import './style.css';
import './landscape.css';
import { Game2A } from './game/core/Game2A';
import { CampaignMap } from './game/ui/CampaignMap';
import { DirectBoardingRuntime } from './game/ui/DirectBoardingRuntime';
import { LandscapeMode } from './game/ui/LandscapeMode';
import { OnFootGame } from './game/onfoot/OnFootGame';
import {
  loadCampaignProgress,
  missionCheckpointFor,
  type MissionCheckpointSnapshot,
} from './game/content/CampaignProgress';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
const campaignRoot = document.querySelector<HTMLElement>('#campaign-map');
const gameShell = document.querySelector<HTMLElement>('#game-shell');
const returnMap = document.querySelector<HTMLButtonElement>('#return-map');

if (!canvas || !campaignRoot || !gameShell || !returnMap) {
  throw new Error('Required campaign UI was not found.');
}

new LandscapeMode();
const game = new Game2A(canvas);
new DirectBoardingRuntime(game, gameShell);
const onFoot = new OnFootGame(gameShell);
let map: CampaignMap;
map = new CampaignMap(
  campaignRoot,
  (planet, checkpoint?: MissionCheckpointSnapshot) => {
    onFoot.hide();
    canvas.style.visibility = 'visible';
    map.hide();
    gameShell.hidden = false;
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

window.addEventListener('coded:boarding-complete', () => {
  canvas.style.visibility = 'hidden';
  onFoot.show();
});

window.addEventListener('coded:onfoot-defeat', () => {
  canvas.style.visibility = 'visible';
  const checkpoint = missionCheckpointFor(loadCampaignProgress(), 'ledger_prime');
  if (checkpoint) {
    game.deployFromMap('ledger_prime', 'EARTH — LEDGER PRIME', checkpoint);
    return;
  }
  gameShell.hidden = true;
  map.show();
});

returnMap.addEventListener('click', () => {
  onFoot.hide();
  canvas.style.visibility = 'visible';
  game.suspend();
  gameShell.hidden = true;
  map.show();
});

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
  onFoot.show();
});
