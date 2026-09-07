import type {CampaignSave,SaveResult} from './CampaignSave';

/** Called after the actual disabled-warship aperture hold completes in 2D. */
export function enterWarship(save:CampaignSave,entry:{planetKey:string;checkpointKey:string;fighterShipKey:string}):SaveResult {
  if(entry.planetKey!=='ledger_prime'||entry.checkpointKey!=='earth.boarding_lock'||!['player','xrpl_striker','ledger_warden'].includes(entry.fighterShipKey))return {ok:false,reason:'condition'};
  return save.update(d=>{
    if(d.quests.includes('earth.warship_entry')||d.warshipOwned)return;
    d.fighterShipKey=entry.fighterShipKey;d.quests.push('earth.warship_entry');
    d.location={mode:'boarding',world:'ledger_prime',checkpoint:'boarding.approach'};
    const fighter=d.earth.missionCheckpoints.ledger_prime;
    if(fighter){d.fighterUpgrades.weapon_tier=fighter.weaponTier;d.fighterUpgrades.barrels=fighter.barrels??1;}
  });
}
export function savedChapterScene(save:CampaignSave):'earth'|'landing'|'boarding'|'space' {
  const d=save.snapshot;
  if(d.location.mode==='space'&&d.transit&&d.warshipOwned)return 'space';
  if(d.location.mode==='hub'&&d.warshipOwned)return 'boarding';
  if(d.location.mode==='boarding')return d.quests.includes('boarding.landed')||!d.quests.includes('earth.warship_entry')?'boarding':'landing';
  return 'earth';
}
