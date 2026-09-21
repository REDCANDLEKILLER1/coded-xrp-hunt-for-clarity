import {Group,Mesh,MeshBasicMaterial,PlaneGeometry,SRGBColorSpace,TextureLoader} from 'three';
import {loadAssetCatalog} from '../core/AssetCatalog';

/** Small signs face the south-facing camera; textures load only with Civic. */
export const CIVIC_ART=[
 ['medical_exchange_sign_v1',-20,2.35,2.1,4.2,2.8],
 ['armory_sign_v1',-20,2.35,-17.9,4.2,2.8],
 ['warship_bank_sign_v1',20,2.35,-17.9,4.2,2.8],
 ['crew_quarters_sign_v1',20,2.35,2.1,4.2,2.8],
 ['water_is_life_poster_v1',-28,1.8,.3,1.6,2.4],
 ['ship_remembers_poster_v1',28,1.8,-19.7,1.6,2.4],
] as const;
export function createCivicArt(signal:AbortSignal):Group{
 const group=new Group();group.name='Civic service signs and posters';
 void loadAssetCatalog().then(async catalog=>{
  if(signal.aborted)return;
  await Promise.all(CIVIC_ART.map(async ([id,x,y,z,w,h])=>{
   const entry=catalog.civic_art?.[id];if(!entry)return;
   const texture=await new TextureLoader().loadAsync(typeof entry==='string'?entry:entry.src);
   if(signal.aborted){texture.dispose();return;}
   texture.colorSpace=SRGBColorSpace;
   const panel=new Mesh(new PlaneGeometry(w,h),new MeshBasicMaterial({map:texture,toneMapped:false}));
   panel.name=id;panel.position.set(x,y,z);group.add(panel);
  }));
 }).catch(error=>{if(!signal.aborted)console.warn('Civic art unavailable',error);});
 return group;
}
