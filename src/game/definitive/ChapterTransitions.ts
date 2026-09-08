import type {CampaignSave,SaveResult} from './CampaignSave';

/** Discovery from an older Earth save is not ownership of the captured ship. */
export function chapterLaunchBlock(save:CampaignSave,planetKey:string):string|null {
  return planetKey==='mars'&&!save.snapshot.warshipOwned?'CAPTURE THE WARSHIP TO TRAVEL':null;
}

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
export function savedChapterScene(save:CampaignSave):'earth'|'landing'|'boarding'|'space'|'mars'|'fog'|'bullion' {
  const d=save.snapshot;
  if(d.location.mode==='surface'&&d.location.world==='fog_moon'&&d.warshipOwned&&d.quests.includes('fog_moon.landed'))return 'fog';
  if(d.location.mode==='surface'&&d.location.world==='bullion_reach'&&d.warshipOwned&&d.quests.includes('bullion_reach.landed'))return 'bullion';
  if(d.location.mode==='surface'&&d.location.world==='mars'&&d.warshipOwned&&d.quests.includes('mars.relief_landed'))return 'mars';
  if(d.location.mode==='space'&&d.transit&&d.warshipOwned)return 'space';
  if(d.location.mode==='hub'&&d.warshipOwned)return 'boarding';
  if(d.location.mode==='boarding')return d.quests.includes('boarding.landed')||!d.quests.includes('earth.warship_entry')?'boarding':'landing';
  return 'earth';
}
