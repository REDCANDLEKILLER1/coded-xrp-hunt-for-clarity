import { build } from 'esbuild';

const result = await build({
  entryPoints: ['src/game/content/DirectBoarding.ts'],
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'silent',
});

const boarding = await import(
  'data:text/javascript,' + encodeURIComponent(result.outputFiles[0].text)
);

const errors = boarding.validateDirectBoarding();
if (errors.length > 0) {
  console.error('L1-G boarding validation FAILED:');
  for (const error of errors) console.error('  - ' + error);
  process.exit(1);
}

const target = boarding.boardingTargetForWarship(200, 120);
if (target.x >= 200 || target.x + target.w <= 200 || target.y <= 120) {
  console.error('L1-G boarding validation FAILED: hangar target is not centered below the warship core.');
  process.exit(1);
}

const director = new boarding.DirectBoardingDirector();
director.start();
director.update(boarding.EARTH_WARSHIP_BOARDING.openingSeconds + 0.01, false);
director.update(0.1, true);
director.update(0.2, false);
if (director.state !== 'ready' || director.captureProgress !== 0) {
  console.error('L1-G boarding validation FAILED: leaving the aperture did not cancel capture safely.');
  process.exit(1);
}

director.update(0.1, true);
director.update(boarding.EARTH_WARSHIP_BOARDING.captureHoldSeconds + 0.01, true);
if (director.state !== 'complete') {
  console.error('L1-G boarding validation FAILED: sustained fighter entry did not complete boarding.');
  process.exit(1);
}

console.log('L1-G boarding validation OK — hangar opens, direct fighter entry is deliberate, and capture is deterministic.');

// The boarding overlay is a positioned canvas stacked above the static game
// canvas. style.css paints every <canvas> with an opaque #02060b background, so
// an overlay that does not explicitly clear it hides the whole game behind a
// flat dark rectangle — the screen renders black with only the STAR MAP button.
import { readFileSync } from 'node:fs';
const runtimeSource = readFileSync(new URL('../src/game/ui/DirectBoardingRuntime.ts', import.meta.url), 'utf8');
if (!/background:\s*'transparent'/.test(runtimeSource)) {
  console.error('L1-G boarding validation FAILED:');
  console.error("  - DirectBoardingRuntime overlay must set background:'transparent'; otherwise the global canvas background hides the game.");
  process.exit(1);
}
