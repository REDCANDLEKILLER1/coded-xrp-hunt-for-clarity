import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Cathedral walkthrough — standalone preview page (NOT wired into the main
 * game). Three.js scene: Blender cathedral v2 (2.5x hall) + Meshy King + Meshy Sentinel,
 * staged on a flat Mars ground plane. Desktop: WASD + pointer-lock mouse
 * look. Mobile: left-half virtual joystick + right-half drag look.
 *
 * Coordinate note: the cathedral was built in Blender (Z-up) and exported to
 * glTF (Y-up), so Blender (x, y, z) maps to Three.js (x, z, -y). The altar
 * sits at Three.js +Z, the entrance arm at -Z. The player spawns in the
 * southern entrance arm, facing the altar (+Z).
 */

// ---------------------------------------------------------------------------
// Staging constants — measured from the Meshy GLBs (2026-10-26).
// GLB node matrices are identity, so accessor min/max are the world boxes.
// King raw: height 1.729649, minY -0.872008 (origin at vertical center).
//   scale = 30.48 / 1.729649 = 17.622072 -> exactly 30.48 m tall on the 10 m
//   dais (top 40.48 m, 94.52 m of headroom under the 135 m vault).
//   v2 hall is the v1 design scaled 2.5x about the origin: arena 200 m
//   across, wall radius 137.5 m, dais 65x32.5 m. Nearest pillar is 21.56 m
//   from the King center; King arms reach 16.77 m; pillar shafts are 2.5 m
//   radius, so clearance is 2.29 m (a fully-scaled 4.0 m shaft would leave
//   only 0.79 m, so shafts were slimmed to meet the 2 m margin bar).
//   foot offset = 0.872008 * 17.622072 = 15.366589.
//   Facing: Blender renders show the face on the -Y side; Blender -Y maps
//   to glTF +Z, so the King front is glTF +Z. To face world -Z (altar ->
//   arena) it needs rotation PI.
// Sentinel raw: height 1.901977, minY -0.952655 (origin at vertical center).
//   scale = 1.9304 / 1.901977 = 1.014944 -> exactly 1.9304 m (6 ft 4 in;
//   v1 staged 1.90 m, corrected in v2).
//   foot offset = 0.952655 * 1.014944 = 0.966891.
//   Facing: Blender renders show the BACK on the +Y side (back of head,
//   back armor, no chest emblem), so the front is Blender -Y = glTF +Z.
//   To face world +Z (arena -> altar) it needs rotation 0.
// ---------------------------------------------------------------------------
const KING_SCALE = 17.622072;
const KING_FOOT_OFFSET = 15.366589;
const KING_ROT_Y = Math.PI;
const SENTINEL_SCALE = 1.014944;
const SENTINEL_FOOT_OFFSET = 0.966891;
const SENTINEL_ROT_Y = 0.0;

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------
const canvas = document.getElementById('view') as HTMLCanvasElement;
const overlay = document.getElementById('overlay') as HTMLDivElement;
const statusEl = document.getElementById('status') as HTMLParagraphElement;
const barEl = document.getElementById('bar') as HTMLDivElement;
const enterBtn = document.getElementById('enter') as HTMLButtonElement;
const errEl = document.getElementById('err') as HTMLParagraphElement;
const joyBase = document.getElementById('joy-base') as HTMLDivElement;
const joyKnob = document.getElementById('joy-knob') as HTMLDivElement;

const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// ---------------------------------------------------------------------------
// Renderer / scene / lights (page-owned; the cathedral GLB exports no lights)
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x140d13);
scene.fog = new THREE.Fog(0x140d13, 65, 240);

const camera = new THREE.PerspectiveCamera(
  isTouch ? 68 : 62,
  window.innerWidth / window.innerHeight,
  0.1,
  600,
);
camera.rotation.order = 'YXZ';

scene.add(new THREE.AmbientLight(0x8996b4, 0.18));
const moonlight = new THREE.DirectionalLight(0x8294c6, 0.55);
moonlight.position.set(80, 145, -60);
scene.add(moonlight);
const throneSpot = new THREE.SpotLight(0xffbd79, 2200, 125, 0.38, 0.65, 2);
throneSpot.position.set(12, 62, 70);
throneSpot.target.position.set(0, 24, 110);
scene.add(throneSpot, throneSpot.target);
const kingRim = new THREE.PointLight(0x738dff, 900, 75, 2);
kingRim.position.set(-18, 48, 121);
scene.add(kingRim);
const arenaFill = new THREE.PointLight(0xff9247, 900, 110, 2);
arenaFill.position.set(0, 32, 0);
scene.add(arenaFill);

// Six grouped, shadow-free candle lights for the large hall. Each represents
// several nearby candles, not a point light per flame. Position against the
// v2 hall's entrance (-Z), arena rim (r=100), and altar (+Z).
const candleSites: Array<[number, number, number]> = [
  [-8, 4.5, -117], [8, 4.5, -117],
  [-70, 5, -70], [70, 5, -70],
  [-18, 13, 91], [18, 13, 91],
];
const candleGroups = candleSites.map(([x, y, z], index) => {
  const light = new THREE.PointLight(0xffa45c, 105, 24, 2);
  light.position.set(x, y, z);
  light.castShadow = false;
  scene.add(light);
  return { light, base: light.intensity, phase: index * 2.39996323,
    slowHz: 0.4 + index * 0.083, fastHz: 1.5 + index * 0.31 };
});
function updateCandleFlicker(t: number): void {
  for (const c of candleGroups) {
    const slow = Math.sin(2 * Math.PI * c.slowHz * t + c.phase);
    const fast = Math.sin(2 * Math.PI * c.fastHz * t + c.phase * 1.73);
    c.light.intensity = c.base * (1 + 0.055 * slow + 0.035 * fast);
  }
}
// Flame mesh animation requires confirmed named GLB flame nodes. No guesses
// or changes to imported geometry in this code-only polish pass.

// Mars ground plane (flat disc; sculpted terrain is a later layer).
const mars = new THREE.Mesh(
  new THREE.CircleGeometry(500, 64),
  new THREE.MeshStandardMaterial({ color: 0x9c4a26, roughness: 1, metalness: 0 }),
);
mars.rotation.x = -Math.PI / 2;
mars.position.y = -0.05;
scene.add(mars);

// ---------------------------------------------------------------------------
// Ground height (Three.js coords; altar +Z, entrance -Z). v2 hall (2.5x):
// Dais top 10.0; steps 3.33 / 6.67; arena floor 1.875; ring walkway 1.1375;
// arms + diagonal chambers 1.50; hall base 0.50; Mars plane 0.
// ---------------------------------------------------------------------------
function groundHeight(x: number, z: number): number {
  const ax = Math.abs(x);
  if (ax <= 32.5 && z >= 93.75 && z <= 126.25) return 10.0;
  if (ax <= 22.5 && z >= 93 && z < 93.75) return 6.667;
  if (ax <= 22.5 && z >= 87 && z < 93) return 3.333;
  const r2 = x * x + z * z;
  if (r2 <= 100 * 100) return 1.875;
  // Diagonal side chambers: 30x30 pads centered at radius 122.5.
  for (let k = 0; k < 4; k++) {
    const t = Math.PI / 4 + (k * Math.PI) / 2;
    const dx = Math.cos(t);
    const dz = Math.sin(t);
    const along = x * dx + z * dz;
    const perp = -x * dz + z * dx;
    if (Math.abs(along - 122.5) <= 15 && Math.abs(perp) <= 15) return 1.5;
  }
  // Cardinal arms: 22.5 m wide strips from radius 97.5 to 140.
  if (
    (ax <= 11.25 && Math.abs(z) >= 97.5 && Math.abs(z) <= 140) ||
    (Math.abs(z) <= 11.25 && ax >= 97.5 && ax <= 140)
  ) {
    return 1.5;
  }
  if (r2 <= 120 * 120) return 1.1375;
  if (r2 <= 140 * 140) return 0.5;
  return 0;
}

// ---------------------------------------------------------------------------
// Player state
// ---------------------------------------------------------------------------
const player = new THREE.Vector3(0, 0, -128); // southern entrance arm
let eyeY = groundHeight(0, -128) + 1.7;
let yaw = Math.PI; // forward +Z (toward the altar)
let pitch = 0;
let started = false;

const keys = new Set<string>();
window.addEventListener('keydown', (e) => keys.add(e.code));
window.addEventListener('keyup', (e) => keys.delete(e.code));

// Virtual joystick (left half) + drag look (right half).
let joyId: number | null = null;
let joyBaseX = 0;
let joyBaseY = 0;
let joyX = 0;
let joyY = 0;
let lookId: number | null = null;
let lookLastX = 0;
let lookLastY = 0;
const JOY_RADIUS = 60;

function placeJoyBase(x: number, y: number): void {
  joyBase.style.left = `${x - 60}px`;
  joyBase.style.top = `${y - 60}px`;
}
function placeJoyKnob(x: number, y: number): void {
  joyKnob.style.left = `${x - 26}px`;
  joyKnob.style.top = `${y - 26}px`;
}

canvas.addEventListener(
  'touchstart',
  (e) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.clientX < window.innerWidth / 2 && joyId === null) {
        joyId = t.identifier;
        joyBaseX = t.clientX;
        joyBaseY = t.clientY;
        joyX = 0;
        joyY = 0;
        joyBase.style.display = 'block';
        joyKnob.style.display = 'block';
        placeJoyBase(t.clientX, t.clientY);
        placeJoyKnob(t.clientX, t.clientY);
      } else if (t.clientX >= window.innerWidth / 2 && lookId === null) {
        lookId = t.identifier;
        lookLastX = t.clientX;
        lookLastY = t.clientY;
      }
    }
    e.preventDefault();
  },
  { passive: false },
);
canvas.addEventListener(
  'touchmove',
  (e) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === joyId) {
        let dx = (t.clientX - joyBaseX) / JOY_RADIUS;
        let dy = (joyBaseY - t.clientY) / JOY_RADIUS;
        const len = Math.hypot(dx, dy);
        if (len > 1) {
          dx /= len;
          dy /= len;
        }
        joyX = dx;
        joyY = dy;
        placeJoyKnob(joyBaseX + dx * JOY_RADIUS, joyBaseY - dy * JOY_RADIUS);
      } else if (t.identifier === lookId) {
        yaw -= (t.clientX - lookLastX) * 0.0045;
        pitch -= (t.clientY - lookLastY) * 0.0045;
        pitch = Math.max(-1.45, Math.min(1.45, pitch));
        lookLastX = t.clientX;
        lookLastY = t.clientY;
      }
    }
    e.preventDefault();
  },
  { passive: false },
);
function endTouch(e: TouchEvent): void {
  for (const t of Array.from(e.changedTouches)) {
    if (t.identifier === joyId) {
      joyId = null;
      joyX = 0;
      joyY = 0;
      joyBase.style.display = 'none';
      joyKnob.style.display = 'none';
    } else if (t.identifier === lookId) {
      lookId = null;
    }
  }
}
canvas.addEventListener('touchend', endTouch);
canvas.addEventListener('touchcancel', endTouch);

// Desktop pointer-lock mouse look.
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  yaw -= e.movementX * 0.0022;
  pitch -= e.movementY * 0.0022;
  pitch = Math.max(-1.45, Math.min(1.45, pitch));
});
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && started && !isTouch) {
    statusEl.textContent = 'Paused — click to resume.';
    enterBtn.textContent = 'Resume';
    enterBtn.disabled = false;
    overlay.style.display = 'flex';
  }
});

enterBtn.addEventListener('click', () => {
  started = true;
  overlay.style.display = 'none';
  if (!isTouch) canvas.requestPointerLock();
});
canvas.addEventListener('click', () => {
  if (!isTouch && started && document.pointerLockElement !== canvas) {
    canvas.requestPointerLock();
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------------------
// Model loading
// ---------------------------------------------------------------------------
const manager = new THREE.LoadingManager();
manager.onProgress = (_url, loaded, total) => {
  barEl.style.width = `${Math.round((loaded / total) * 100)}%`;
};
const loader = new GLTFLoader(manager);

function loadModel(path: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    loader.load(
      path,
      (gltf) => resolve(gltf.scene),
      undefined,
      (err) => reject(err),
    );
  });
}

function placeFigure(
  obj: THREE.Object3D,
  scale: number,
  footOffset: number,
  rotY: number,
  x: number,
  groundY: number,
  z: number,
  label: string,
): void {
  obj.scale.setScalar(scale);
  obj.rotation.y = rotY;
  obj.position.set(x, groundY + footOffset, z);
  scene.add(obj);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  console.log(
    `[walkthrough] ${label} staged: height=${size.y.toFixed(2)} m, ` +
      `pos=(${x}, ${(groundY + footOffset).toFixed(2)}, ${z}), rotY=${rotY.toFixed(2)}`,
  );
}

let loaded = 0;
function markLoaded(label: string): void {
  loaded += 1;
  statusEl.textContent = `Loaded ${loaded} of 3: ${label}…`;
  if (loaded === 3) {
    statusEl.textContent = isTouch
      ? 'Ready — tap Enter, then left side moves, right side looks.'
      : 'Ready — click Enter to walk the cathedral.';
    enterBtn.disabled = false;
    barEl.style.width = '100%';
  }
}
function failLoad(label: string, err: unknown): void {
  console.error(`[walkthrough] failed to load ${label}`, err);
  errEl.textContent = `Failed to load ${label}. Check the connection and reload the page.`;
}

loadModel('walkthrough/cathedral.glb').then(
  (obj) => {
    scene.add(obj);
    markLoaded('cathedral');
  },
  (err) => failLoad('cathedral.glb', err),
);
loadModel('walkthrough/king.glb').then(
  (obj) => {
    // King on the dais at the altar (Three.js +Z), facing the arena (-Z).
    placeFigure(obj, KING_SCALE, KING_FOOT_OFFSET, KING_ROT_Y, 0, 10.0, 110, 'King');
    markLoaded('King');
  },
  (err) => failLoad('king.glb', err),
);
loadModel('walkthrough/sentinel.glb').then(
  (obj) => {
    // Sentinel in the arena near the entrance (-Z), facing the altar (+Z).
    placeFigure(obj, SENTINEL_SCALE, SENTINEL_FOOT_OFFSET, SENTINEL_ROT_Y, 0, 1.875, -75, 'Sentinel');
    markLoaded('Sentinel');
  },
  (err) => failLoad('sentinel.glb', err),
);

// ---------------------------------------------------------------------------
// Movement loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();

function animate(): void {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const move = new THREE.Vector3();

  if (keys.has('KeyW') || keys.has('ArrowUp')) move.add(fwd);
  if (keys.has('KeyS') || keys.has('ArrowDown')) move.sub(fwd);
  if (keys.has('KeyD') || keys.has('ArrowRight')) move.add(right);
  if (keys.has('KeyA') || keys.has('ArrowLeft')) move.sub(right);
  move.addScaledVector(fwd, joyY);
  move.addScaledVector(right, joyX);
  if (move.lengthSq() > 1) move.normalize();

  const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 14 : 6;
  player.addScaledVector(move, speed * dt);

  // Stay near the action (Mars plane is 500 m; keep the walk to 500 m).
  const rr = Math.hypot(player.x, player.z);
  if (rr > 500) {
    player.x *= 500 / rr;
    player.z *= 500 / rr;
  }

  const targetEye = groundHeight(player.x, player.z) + 1.7;
  eyeY += (targetEye - eyeY) * Math.min(1, dt * 10);
  camera.position.set(player.x, eyeY, player.z);
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;

  updateCandleFlicker(clock.elapsedTime);
  renderer.render(scene, camera);
}
animate();
