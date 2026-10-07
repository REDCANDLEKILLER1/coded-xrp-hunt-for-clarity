import {CampaignSave,SAVE_PREFIX} from './CampaignSave';
import {CAMPAIGN_PROGRESS_STORAGE_KEY,LEGACY_PROGRESS_STORAGE_KEY,LEGACY_V1_PROGRESS_STORAGE_KEY} from '../content/CampaignProgress';

/** During public testing every page opening is a clean run. Checkpoints are
 * held only in memory for retries within that page. Never import old weapons. */
export function startFreshTestRun(storage:Storage|null,slot='campaign'):CampaignSave {
  if(storage){
    const keys=new Set([CAMPAIGN_PROGRESS_STORAGE_KEY,LEGACY_PROGRESS_STORAGE_KEY,LEGACY_V1_PROGRESS_STORAGE_KEY]);
    try {for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith(`${SAVE_PREFIX}:`))keys.add(key);}}catch { /* Still ignore inaccessible saves. */ }
    for(const key of keys){try {storage.removeItem(key);}catch { /* Memory-only run cannot restore these. */ }}
  }
  const save=new CampaignSave(null,slot);
  save.update(d=>{d.fighterUpgrades={weapon_rank:1,weapon_family:0,rapid_fire:0,weapon_level:1};});
  return save;
}
