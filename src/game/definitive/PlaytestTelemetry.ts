/** Feed the existing on-device LOG viewer without coupling gameplay to its storage implementation. */
type Viewer={log:(category:string,message:string,data?:Record<string,unknown>)=>void;sample:(key:string,ms:number,category:string,message:string,data?:Record<string,unknown>)=>void};
function viewer():Viewer|undefined{return typeof window==='undefined'?undefined:(window as unknown as {codedLog?:Viewer}).codedLog;}
export function recordPlaytest(category:'mission'|'combat'|'error',message:string,data:Record<string,unknown>={}):void{viewer()?.log(category,message,data);}
export function samplePlaytest(key:string,message:string,data:Record<string,unknown>):void{viewer()?.sample(key,15000,'combat',message,data);}
