import { build } from 'esbuild';

async function loadModule(entryPoint) {
  const result = await build({
    entryPoints: [entryPoint],
    bundle: true,
    format: 'esm',
    write: false,
    logLevel: 'silent',
  });
  return import('data:text/javascript,' + encodeURIComponent(result.outputFiles[0].text));
}

const warship = await loadModule('src/game/content/RegulatoryWarship.ts');
const errors = warship.validateRegulatoryWarship();
if (errors.length > 0) {
  console.error('L1-F warship validation FAILED:');
  for (const error of errors) console.error('  - ' + error);
  process.exit(1);
}

const director = new warship.RegulatoryWarshipDirector();
const destroy = (key) => {
  let guard = 0;
  while (!director.allSystems.find((system) => system.key === key)?.destroyed && guard < 50) {
    director.hit(key, 4);
    guard += 1;
  }
};

destroy('port_battery');
destroy('starboard_battery');
if (director.phase !== 'shield' || director.targetableSystems.length !== 0) {
  console.error('L1-F warship validation FAILED: shield relay should remain protected after batteries fall.');
  process.exit(1);
}
if (!director.exposeShieldWithFogBreaker() || director.targetableSystems[0]?.key !== 'shield_relay') {
  console.error('L1-F warship validation FAILED: Fog Breaker did not expose the shield relay.');
  process.exit(1);
}
destroy('shield_relay');
if (director.phase !== 'engines' || director.targetableSystems.length !== 2) {
  console.error('L1-F warship validation FAILED: engine nodes did not become the next targets.');
  process.exit(1);
}
destroy('engine_port');
destroy('engine_starboard');
if (director.phase !== 'hangar' || director.targetableSystems[0]?.key !== 'hangar_defense') {
  console.error('L1-F warship validation FAILED: hangar defense did not become the final exterior target.');
  process.exit(1);
}
destroy('hangar_defense');
if (director.phase !== 'disabled' || director.objective !== 'WARSHIP DISABLED // BOARDING WINDOW OPEN') {
  console.error('L1-F warship validation FAILED: warship was not disabled cleanly.');
  process.exit(1);
}

console.log('L1-F warship validation OK — batteries -> Fog Breaker relay -> engines -> hangar -> disabled.');
