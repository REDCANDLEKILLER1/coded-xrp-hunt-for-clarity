import './style.css';
import { Game2A } from './game/core/Game2A';
import { CampaignMap } from './game/ui/CampaignMap';
import { DirectBoardingRuntime } from './game/ui/DirectBoardingRuntime';
import type { MissionCheckpointSnapshot } from './game/content/CampaignProgress';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
const campaignRoot = document.querySelector<HTMLElement>('#campaign-map');
const gameShell = document.querySelector<HTMLElement>('#game-shell');
const returnMap = document.querySelector<HTMLButtonElement>('#return-map');

if (!canvas || !campaignRoot || !gameShell || !returnMap) {
  throw new Error('Required campaign UI was not found.');
}

const game = new Game2A(canvas);
new DirectBoardingRuntime(game, gameShell);
let map: CampaignMap;
map = new CampaignMap(
  campaignRoot,
  (planet, checkpoint?: MissionCheckpointSnapshot) => {
    map.hide();
    gameShell.hidden = false;
    game.deployFromMap(planet.key, planet.label, checkpoint);
  },
  () => {
    map.hide();
    gameShell.hidden = false;
    game.deployTestMode();
  },
);

returnMap.addEventListener('click', () => {
  game.suspend();
  gameShell.hidden = true;
  map.show();
});

void game.start();
