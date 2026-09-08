import {EquirectangularReflectionMapping,SRGBColorSpace,Texture} from 'three';
import {loadAssetCatalog} from '../core/AssetCatalog';
export async function loadSpaceBackdrop(bullion:boolean,signal:AbortSignal):Promise<Texture>{
 const catalog=await loadAssetCatalog(),id=bullion?'bullion_dust_v1':'deep_space_dust_v1',entry=catalog.backgrounds?.[id];
 if(!entry||typeof entry==='string'||entry.type!=='image')throw Error('Space background is not registered');
 const response=await fetch(entry.src,{signal});if(!response.ok)throw Error('Space background could not load');
 const blob=await response.blob();if(entry.bytes!==blob.size)throw Error('Space background download is incomplete');
 const bitmap=await createImageBitmap(blob);if(signal.aborted){bitmap.close();throw new DOMException('Scene load cancelled','AbortError');}
 const texture=new Texture(bitmap);texture.colorSpace=SRGBColorSpace;texture.mapping=EquirectangularReflectionMapping;texture.needsUpdate=true;return texture;
}
export function disposeSpaceBackdrop(texture:Texture):void{texture.dispose();(texture.image as ImageBitmap)?.close?.();}
