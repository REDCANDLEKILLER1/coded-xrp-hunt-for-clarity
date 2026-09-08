import type {FreightPoint3} from './FreightConvoy';
import type {SiegeHazard} from './MarketSiegeEngine';
/** One committed lane at a time. Covered service road avoids the scanner;
 * express, east and west expose physically different areas of the freight yard. */
export class FreightScanner{
  readonly hazards:SiegeHazard[]=[];private age=0;private next=3;private serial=100000;
  constructor(readonly source:FreightPoint3){if(![source.x,source.y,source.z].every(Number.isFinite))throw Error('Actual scanner anchor required');}
  update(dt:number,sector:string|null,active:boolean):void{
    if(!active){this.hazards.length=0;this.next=3;return;}
    if(!Number.isFinite(dt)||dt<=0||dt>.25)return;
    this.age+=dt;this.next-=dt;
    for(let i=this.hazards.length-1;i>=0;i--){const h=this.hazards[i],delay=Math.min(dt,h.tell);h.tell-=delay;h.age+=dt-delay;if(h.age>=h.duration)this.hazards.splice(i,1);}
    if(this.next>0||this.hazards.length||!['express','east','west'].includes(sector??''))return;
    this.next=5.8;const sweep=(this.serial%3-1)*2;
    const from=sector==='express'?{x:sweep,y:.1,z:12}:sector==='east'?{x:12+sweep,y:.1,z:-12}:{x:-23,y:.1,z:-23+sweep};
    const target=sector==='west'?{x:-9,y:.1,z:from.z}:{x:from.x,y:.1,z:sector==='express'?-5:-29};
    this.hazards.push({id:++this.serial,kind:'strip',from,target,tell:1.8,age:0,travel:0,duration:.45,radius:.8,damaged:new Set()});
  }
}
