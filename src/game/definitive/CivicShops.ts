import {loadAssetCatalog} from '../core/AssetCatalog';
import type {BoardingQuest} from './BoardingQuest';

export function createCivicShop(quest:BoardingQuest,kind:'medical'|'armory',close:()=>void):HTMLElement {
  const panel=document.createElement('section');panel.className=`boarding-shop civic-shop ${kind}`;
  panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
  const heading=document.createElement('h2');heading.id='civic-shop-title';
  heading.textContent=kind==='medical'?'MEDICAL EXCHANGE':'CAPACITOR WORKSHOP';
  panel.setAttribute('aria-labelledby',heading.id);
  const seller=document.createElement('p');seller.className='civic-vendor-name';
  seller.textContent=kind==='medical'?'SERA VALE · FIELD MEDIC':'IVO ROOK · ARMORER';
  const dialogue=document.createElement('p');dialogue.className='civic-dialogue';
  dialogue.textContent=kind==='medical'?'“This was a weapons locker. Now it keeps people alive. Bring back what you don’t need—someone else will.”':'“They built this ship to keep us out. Now we use its tools to keep our people standing.”';
  const balance=document.createElement('p');balance.className='civic-shop-balance';
  const description=document.createElement('p');
  description.textContent=kind==='medical'?'MED PACK · Carry into combat and use when injured. Cargo capacity: 9.':'MELEE CAPACITOR · Permanent +8 close-strike damage. One installation; retained across saves.';
  const art=document.createElement('img');art.className='civic-item-art';art.alt=kind==='medical'?'Armored field medical kit':'Gauntlet melee capacitor';art.width=180;art.height=180;
  void loadAssetCatalog().then(catalog=>{const entry=catalog.items?.[kind==='medical'?'med_pack':'melee_capacitor'];if(entry)art.src=typeof entry==='string'?entry:entry.src;}).catch(()=>{art.hidden=true;});
  const feedback=document.createElement('p');feedback.className='civic-shop-feedback';feedback.setAttribute('role','status');
  const buy=document.createElement('button'),sell=document.createElement('button'),back=document.createElement('button');
  const paint=()=>{
    const save=quest.save.snapshot,count=save.inventory.med_pack??0;
    balance.textContent=`${save.credits} CREDITS · ${count}/9 MED PACKS`;
    if(kind==='medical'){
      buy.textContent=count>=9?'CARGO FULL':save.credits<35?'NEED 35 CREDITS':'BUY MED PACK · 35';
      buy.disabled=count>=9||save.credits<35;
      sell.textContent=count?'SELL MED PACK · 18':'NO PACKS TO SELL';sell.disabled=count===0;
    }else{
      const owned=!!save.heroUpgrades.melee_capacitor;
      buy.textContent=owned?'CAPACITOR INSTALLED':save.credits<140?'NEED 140 CREDITS':'INSTALL CAPACITOR · 140';buy.disabled=owned||save.credits<140;
    }
  };
  buy.addEventListener('click',()=>{
    const result=kind==='medical'?quest.tradeMedPack('buy'):quest.installMeleeCapacitor();
    feedback.textContent=result.ok?(kind==='medical'?'Med pack added to cargo. Purchase saved.':'Capacitor installed. Upgrade saved.'):'Purchase could not be saved or requirements changed. No purchase confirmed.';paint();
  });
  sell.addEventListener('click',()=>{const result=quest.tradeMedPack('sell');feedback.textContent=result.ok?'Med pack sold for 18 credits. Sale saved.':'Sale could not be completed.';paint();});
  back.textContent='RETURN TO MARKET';back.addEventListener('click',close);
  panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}});
  panel.append(heading,back,seller,dialogue,art,balance,description,buy);if(kind==='medical')panel.append(sell);panel.append(feedback);paint();
  return panel;
}
