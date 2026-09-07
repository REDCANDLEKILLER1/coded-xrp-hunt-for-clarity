import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { Vector3 } from 'three';
const source=readFileSync('src/game/definitive/PlanetApproach.ts','utf8');
async function load(code) {
  const out=await build({stdin:{contents:code,loader:'ts',resolveDir:process.cwd()},bundle:true,write:false,format:'esm',logLevel:'silent'});
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
}
const {constrainPlanetApproach:constrain,EARTH_FLIGHT,MARS_FLIGHT,PLANET_CLEARANCE,MARS_APPROACH}=await load(source);
let sweeps=0;
for(const planet of [EARTH_FLIGHT,MARS_FLIGHT]) {
  const center=new Vector3(...planet.center),radius=planet.radius+PLANET_CLEARANCE;
  for(let i=0;i<80;i++) {
    const normal=new Vector3(Math.sin(i*2.399),i/40-1,Math.cos(i*2.399)).normalize();
    const start=center.clone().addScaledVector(normal,radius+500),end=center.clone().addScaledVector(normal,-radius-500);
    const result=constrain(start,end,planet);
    assert.ok(result.limited,'sweep catches a whole-planet crossing with both endpoints outside');
    assert.ok(result.position.clone().sub(center).dot(normal)>=radius,'cannot exit the far side of the planet');
    const outward=start.clone().addScaledVector(normal,150);
    assert.ok(constrain(start,outward,planet).position.distanceTo(outward)<1e-8,'turning away is unrestricted');
    const tangent=normal.clone().cross(new Vector3(0,1,0)).normalize();
    const near=center.clone().addScaledVector(normal,radius+1);
    const sliding=constrain(near,near.clone().addScaledVector(normal,-30).addScaledVector(tangent,20),planet);
    assert.ok(sliding.position.distanceTo(center)>=radius,'glancing flight stays outside');
    assert.ok(sliding.position.clone().sub(near).dot(tangent)>10,'tangential steering survives');
    sweeps++;
  }
  const recovered=constrain(center,center,planet);
  assert.ok(recovered.limited&&recovered.position.distanceTo(center)>radius,'old inside-planet checkpoint recovers');
  let pose=center.clone().add(new Vector3(0,0,radius+200));
  for(let step=0;step<1000;step++)pose=constrain(pose,pose.clone().add(new Vector3(0,0,-14.3)),planet).position;
  assert.ok(pose.distanceTo(center)>=radius,'sustained boost cannot creep through');
}
assert.ok(MARS_APPROACH.distanceTo(new Vector3(...MARS_FLIGHT.center))>MARS_FLIGHT.radius+PLANET_CLEARANCE+700,'navigation points above the surface');
const mutant=await load(source.replace('const t = (-b - Math.sqrt(discriminant)) / (2 * a);','const t = 2;'));
assert.equal(mutant.constrainPlanetApproach(new Vector3(0,0,6000),new Vector3(0,0,-6000),{center:[0,0,0],radius:4400}).limited,false,'control demonstrates bypassing the swept entry fails the collision contract');
console.log(`planet-approach: OK — ${sweeps} translated radial/glancing sweeps, tunnelling, outward escape, sustained boost, old-pose recovery and above-surface navigation. Swept-entry mutation detected.`);
