import './style.css';
import { Game2A } from './game/core/Game2A';
import { MissionDirector } from './game/content/MissionDirector';
import { missionForPlanet } from './game/content/missions';
import { CampaignMap } from './game/ui/CampaignMap';
import type { MissionCheckpointSnapshot } from './game/content/CampaignProgress';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
const campaignRoot = document.querySelector<HTMLElement>('#campaign-map');
const gameShell = document.querySelector<HTMLElement>('#game-shell');
const returnMap = document.querySelector<HTMLButtonElement>('#return-map');

if (!canvas || !campaignRoot || !gameShell || !returnMap) {
  throw new Error('Required campaign UI was not found.');
}

const game = new Game2A(canvas);
const missionDirector = new MissionDirector();
let map: CampaignMap;
map = new CampaignMap(
  campaignRoot,
  (planet, checkpoint?: MissionCheckpointSnapshot) => {
    const mission = missionForPlanet(planet.key);
    if (mission) {
      const resumable = checkpoint
        && checkpoint.missionKey === mission.key
        && checkpoint.planetKey === planet.key
        && mission.acts.some((act) => act.key === checkpoint.resumeActKey);
      if (resumable) missionDirector.startAtAct(mission, checkpoint.resumeActKey);
      else missionDirector.start(mission);
    } else {
      missionDirector.clear();
    }

    map.hide();
    gameShell.hidden = false;
    const destination = mission?.label ?? planet.label;
    game.deployFromMap(planet.key, checkpoint ? `${destination} // ${checkpoint.checkpointLabel}` : destination);
  },
  () => {
    missionDirector.clear();
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
