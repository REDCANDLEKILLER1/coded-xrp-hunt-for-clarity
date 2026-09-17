import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
const load=async path=>{const result=await build({entryPoints:[path],bundle:true,write:false,format:'esm',logLevel:'silent'});return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);};
const throttle=await load('src/game/definitive/SpaceThrottle.ts');

assert.equal(throttle.stepThrottle(1,1),1.1);
assert.equal(throttle.stepThrottle(1,-1),.9);
assert.equal(throttle.stepThrottle(2.2,1),2.2,'upper throttle stop');
assert.equal(throttle.stepThrottle(.3,-1),.3,'lower throttle stop');
for(let value=.3;value<2.2;value=throttle.stepThrottle(value,1)){
  const next=throttle.stepThrottle(value,1);assert.equal(throttle.stepThrottle(next,-1),value,'every upward throttle step must reverse exactly');
}
assert.equal(throttle.commandedSpeed(130,1,false,false),130);
assert.equal(throttle.commandedSpeed(130,.5,false,false),65);
assert.equal(throttle.commandedSpeed(130,.5,true,false),32.5,'brake temporarily overrides throttle');
assert.equal(throttle.commandedSpeed(130,.5,false,true),286,'boost temporarily overrides throttle');

class FakeElement extends EventTarget{
  constructor(){super();this.children=[];this.dataset={};this.textContent='';this.className='';this.type='';this.attributes={};}
  append(...children){this.children.push(...children);}
  setAttribute(key,value){this.attributes[key]=value;}
}
const doc={createElement:()=>new FakeElement()},steps=[];
const controls=throttle.createThrottleUI(doc,direction=>steps.push(direction));
assert.equal(controls.root.children.length,3,'touch throttle renders minus, readout and plus');
controls.root.children[0].dispatchEvent(new Event('click'));controls.root.children[2].dispatchEvent(new Event('click'));
assert.deepEqual(steps,[-1,1],'touch buttons drive signed throttle changes');
controls.update(.7);assert.equal(controls.root.children[1].textContent,'70%','touch readout reports current throttle');
const wheelRoot=new FakeElement();throttle.bindThrottleWheel(wheelRoot,direction=>steps.push(direction));
for(const deltaY of [-120,120]){const event=new Event('wheel',{cancelable:true});Object.defineProperty(event,'deltaY',{value:deltaY});wheelRoot.dispatchEvent(event);assert.equal(event.defaultPrevented,true,'wheel throttle prevents page scrolling');}
assert.deepEqual(steps,[-1,1,1,-1],'desktop wheel drives both throttle directions');

const focus=await load('src/game/definitive/FocusPolicy.ts'),fakeWindow=new EventTarget(),fakeDocument=new EventTarget();fakeDocument.hidden=false;globalThis.window=fakeWindow;globalThis.document=fakeDocument;
let clears=0,pauses=0;const life=new AbortController();focus.bindFocusPolicy(life.signal,()=>clears++,()=>pauses++);
fakeWindow.dispatchEvent(new Event('blur'));assert.equal(clears,1);assert.equal(pauses,0,'desktop focus loss clears held input without pausing');
fakeDocument.hidden=true;fakeDocument.dispatchEvent(new Event('visibilitychange'));assert.equal(pauses,1,'actually hiding the game pauses safely');life.abort();

const scenes=['BoardingScene','BullionReachScene','FogMoonScene','LandingScene','MarsExcavationScene','MarsSurfaceScene','SpaceScene'];
for(const name of scenes){const source=readFileSync(`src/game/definitive/${name}.ts`,'utf8');assert.match(source,/bindFocusPolicy\(/,`${name} must use the shared focus policy`);assert.doesNotMatch(source,/addEventListener\('blur'/,`${name} must not bypass the shared focus policy`);}
console.log(`space-throttle: OK — reversible bounded throttle, real wheel/touch controls and one driven focus policy across ${scenes.length} gameplay scenes.`);
