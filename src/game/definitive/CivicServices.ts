import type {BoardingQuest} from './BoardingQuest';

/** Read-only shared account and an explicit, failure-aware checkpoint service. */
export function createCivicService(quest:BoardingQuest,kind:'bank'|'quarters',close:()=>void):HTMLElement{
 const panel=document.createElement('section');panel.className='boarding-shop civic-shop civic-service';
 panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
 const title=document.createElement('h2');title.id='civic-service-title';title.textContent=kind==='bank'?'WARSHIP BANK':'CREW QUARTERS';panel.setAttribute('aria-labelledby',title.id);
 const back=document.createElement('button');back.textContent='RETURN TO CIVIC';back.addEventListener('click',close);
 const summary=document.createElement('p');summary.className='civic-shop-balance';
 const description=document.createElement('p');description.className='civic-dialogue';
 const feedback=document.createElement('p');feedback.setAttribute('role','status');feedback.className='civic-shop-feedback';
 const paint=()=>{const s=quest.save.snapshot;summary.textContent=kind==='bank'?`${s.credits} AVAILABLE CREDITS · ${s.inventory.med_pack??0}/9 MED PACKS`:`SAVED BERTH: ${s.location.checkpoint==='civic.quarters'?'CREW QUARTERS':'NOT SET'}`;};
 description.textContent=kind==='bank'?'One balance follows you from the markets to your fighter and the warship. Purchases save automatically. No deposit is required. Vault services and contracts are not available yet.':'Set this berth as your return point. Your credits, cargo and upgrades stay with you. Resting is free.';
 panel.append(title,back,summary,description);
 if(kind==='quarters'){const rest=document.createElement('button');rest.textContent='REST & SAVE · FREE';rest.addEventListener('click',()=>{const result=quest.restAtQuarters();feedback.textContent=result.ok?'Progress saved. You will return to these quarters.':'Save failed. Your previous checkpoint is unchanged. Please retry.';paint();});panel.append(rest);}
 panel.append(feedback);panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}});paint();return panel;
}
