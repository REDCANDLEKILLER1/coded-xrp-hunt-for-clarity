import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const compiled=await build({entryPoints:['src/game/definitive/BoardingCameraZoom.ts'],bundle:true,format:'esm',platform:'node',write:false,logLevel:'silent'});
const {scaleBoardingCameraByPinch,scaleBoardingCameraByWheel}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
assert.equal(scaleBoardingCameraByPinch(1,100,200),.55, 'spreading fingers zooms in with clamp');
assert.equal(scaleBoardingCameraByPinch(1,200,100),1.8,'pinching in zooms out with clamp');
assert.equal(scaleBoardingCameraByPinch(1,0,200),1,'invalid gesture ignored');
assert.equal(scaleBoardingCameraByPinch(.8,100,100),.8,'stationary gesture leaves camera unchanged');
assert.ok(scaleBoardingCameraByWheel(1,100)>1,'scroll down zooms out');
assert.ok(scaleBoardingCameraByWheel(1,-100)<1,'scroll up zooms in');
const boarding=readFileSync('src/game/definitive/BoardingScene.ts','utf8');
for(const marker of ['this.cameraTouches.set(event.pointerId','scaleBoardingCameraByPinch(','this.cameraZoom','canvas.addEventListener(\'wheel\'','this.cameraTouches.clear()']){
  assert.ok(boarding.includes(marker), 'boarding camera zoom consumer missing: '+marker);
}
console.log('boarding-camera-zoom: OK');
