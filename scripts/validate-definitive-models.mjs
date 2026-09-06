import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
const manifest = JSON.parse(readFileSync('public/assets/manifest.json', 'utf8'));
const model = manifest.models.regulatory_warship;
const bytes = readFileSync(`public${model.src}`);
assert.equal(model.type, 'model');
assert.equal(bytes.length, model.bytes);
assert.equal(createHash('sha256').update(bytes).digest('hex'), model.sha256);
assert.equal(bytes.readUInt32LE(0), 0x46546c67);
assert.equal(bytes.readUInt32LE(4), 2);
assert.equal(bytes.readUInt32LE(8), bytes.length);
const doc = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
assert.ok(!doc.buffers.some((buffer) => buffer.uri), 'runtime GLB must be self-contained');
assert.equal(doc.meshes.length, 6);
assert.ok(bytes.length < 500_000);
for (const filename of readdirSync('public/assets/models')) assert.ok(Object.values(manifest.models).some((entry) => entry.src.endsWith(`/${filename}`)), `orphan model: ${filename}`);
const names = ['Ship_Origin', 'Muzzle_FL', 'Muzzle_FR', 'Muzzle_L', 'Muzzle_R', 'Engine_L', 'Engine_R', 'Camera_Chase', 'Camera_Cockpit_Forward'];
for (const name of names) assert.equal(doc.nodes.filter((node) => node.name === name).length, 1, `unique attachment: ${name}`);

const load = async (entry) => {
  const compiled = await build({ entryPoints: [entry], bundle: true, format: 'esm', write: false, logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
};
let wrongLength = false;
globalThis.fetch = async (url) => new Response(String(url).endsWith('/manifest.json') ? JSON.stringify(manifest) : wrongLength ? bytes.subarray(0, 30) : bytes);
const { loadModel, disposeObject } = await load('src/game/definitive/ModelAssets.ts');
const gltf = await loadModel('regulatory_warship', new AbortController().signal);
gltf.scene.updateMatrixWorld(true);
let triangles = 0;
let disposed = 0;
gltf.scene.traverse((object) => {
  if (object.isMesh) {
    triangles += object.geometry.index.count / 3;
    object.geometry.addEventListener('dispose', () => disposed++);
  }
});
assert.equal(triangles, 5156, 'real GLTFLoader decodes every triangle');
const muzzlePositions = names.filter((name) => name.startsWith('Muzzle')).map((name) => {
  const node = gltf.scene.getObjectByName(name);
  const elements = node.matrixWorld.elements;
  return elements.slice(12, 15);
});
assert.equal(new Set(muzzlePositions.map((position) => position.join(','))).size, 4);
assert.ok(muzzlePositions.every((position) => position.every(Number.isFinite)));
disposeObject(gltf.scene);
assert.equal(disposed, 6, 'all GPU geometries released');
wrongLength = true;
await assert.rejects(loadModel('regulatory_warship', new AbortController().signal), /incomplete/);
wrongLength = false;
const aborted = new AbortController(); aborted.abort();
await assert.rejects(loadModel('regulatory_warship', aborted.signal), /cancelled/);

// The existing 2D loader must never try to decode a mesh or audio as an image.
const imageSources = [];
globalThis.Image = class { set src(value) { imageSources.push(value); queueMicrotask(() => this.onload()); } };
manifest.audio = { test: { type: 'audio', src: '/assets/audio/test.mp3' } };
const { AssetLoader } = await load('src/game/core/AssetLoader.ts');
const images = new AssetLoader();
await images.loadManifest();
assert.ok(imageSources.length > 0);
assert.ok(imageSources.every((src) => !/\.(glb|gltf|mp3)$/.test(src)));
assert.equal(images.counts().missing, 0);
console.log(`definitive-models: OK — actual GLB decode, ${bytes.length} bytes, 5156 triangles, six surfaces, nine nodes, four distinct muzzles, disposal, failed/cancelled load, typed 2D exclusion.`);
