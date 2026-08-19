import './style.css';
import { Game2A } from './game/core/Game2A';
import { CampaignMap } from './game/ui/CampaignMap';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
const campaignRoot = document.querySelector<HTMLElement>('#campaign-map');
const gameShell = document.querySelector<HTMLElement>('#game-shell');
const returnMap = document.querySelector<HTMLButtonElement>('#return-map');

if (!canvas || !campaignRoot || !gameShell || !returnMap) {
  throw new Error('Required campaign UI was not found.');
}

const game = new Game2A(canvas);
let map: CampaignMap;
map = new CampaignMap(
  campaignRoot,
  (planet) => {
    map.hide();
    gameShell.hidden = false;
    game.deployFromMap(planet.key, planet.label);
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
