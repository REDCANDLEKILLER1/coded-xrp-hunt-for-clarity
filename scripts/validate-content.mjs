// Data-driven content smoke test.
//
// Pure data validation of src/game/content/registry.ts — no DOM, no engine.
// Bundles the TypeScript registry with the already-installed esbuild (a Vite
// dependency; no new package is added) and runs validateContent(). Exits
// non-zero on any problem so it can gate locally or in CI later.
//
// Run with: npm test

import { build } from 'esbuild';

const result = await build({
  entryPoints: ['src/game/content/registry.ts'],
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'silent',
});

const mod = await import(
  'data:text/javascript,' + encodeURIComponent(result.outputFiles[0].text)
);

const errors = mod.validateContent();

if (errors.length > 0) {
  console.error('Content validation FAILED:');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

console.log('Content validation OK — registry is well-formed.');

const progressResult = await build({
  entryPoints: ['src/game/content/CampaignProgress.ts'],
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'silent',
});

const progress = await import(
  'data:text/javascript,' + encodeURIComponent(progressResult.outputFiles[0].text)
);

const malformed = progress.parseCampaignProgress('{not-json');
const sanitized = progress.parseCampaignProgress('{"highScore":-4,"highestWave":8.9,"victories":"many"}');
const recorded = progress.recordCampaignRun({ highScore: 500, highestWave: 4, victories: 1 }, 900, 7, true);

if (malformed.highScore !== 0 || sanitized.highScore !== 0 || sanitized.highestWave !== 8 || sanitized.victories !== 0) {
  console.error('Campaign progress validation FAILED: malformed persistence was not sanitized.');
  process.exit(1);
}
if (recorded.highScore !== 900 || recorded.highestWave !== 7 || recorded.victories !== 2) {
  console.error('Campaign progress validation FAILED: completed run was not recorded correctly.');
  process.exit(1);
}

console.log('Campaign progress validation OK — persistence is sanitized and monotonic.');
