import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Cathedral walkthrough — standalone preview page (NOT wired into the main
 * game). Three.js scene: Blender cathedral v1 + Meshy King + Meshy Sentinel,
 * staged on a flat Mars ground plane. Desktop: WASD + pointer-lock mouse
 * look. Mobile: left-half virtual joystick + right-half drag look.
 *
 * Coordinate note: the cathedral was built in Blender (Z-up) and exported to
 * glTF (Y-up), so Blender (x, y, z) maps to Three.js (x, z, -y). The altar
 * sits at Three.js +Z, the entrance arm at -Z. The player spawns in the
 * arena near the entrance, facing the altar (+Z).
 */

// ---------------------------------------------------------------------------
// Staging constants — measured from the Meshy GLBs (2026-10-26).
// GLB node matrices are identity, so accessor min/max are the world boxes.
// King raw: height 1.729649, minY -0.872008 (origin at vertical center).
//   scale = 30.48 / 1.729649 = 17.622072 -> exactly 30.48 m tall on the 4 m
//   dais (top 34.48 m, 19.52 m of headroom under the 54 m vault).
//   foot offset = 0.872008 * 17.622072 = 15.366589.
//   Facing: Blender renders show the face on the -Y side; Blender -Y maps
//   to glTF +Z, so the King front is glTF +Z. To face world -Z (altar ->
//   arena) it needs rotation PI.
// Sentinel raw: height 1.901977, minY -0.952655 (origin at vertical center).
//   scale = 1.9 / 1.901977 = 0.998961 -> 1.90 m tall (already ~man-sized).
//   foot offset = 0.952655 * 0.998961 = 0.951665.
//   Facing: Blender renders show the BACK on the +Y side (back of head,
//   back armor, no chest emblem), so the front is Blender -Y = glTF +Z.
//   To face world +Z (arena -> altar) it needs rotation 0.
// ---------------------------------------------------------------------------
const KING_SCALE = 17.622072;
const KING_FOOT_OFFSET = 15.366589;
const KING_ROT_Y = Math.PI;
const SENTINEL_SCALE = 0.998961;
const SENTINEL_FOOT_OFFSET = 0.951665;
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
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xc27a4a); // Mars butterscotch sky
scene.fog = new THREE.Fog(0xc27a4a, 120, 480);

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  1200,
);
camera.rotation.order = 'YXZ';

scene.add(new THREE.AmbientLight(0xffe0c0, 0.65));
const sun = new THREE.DirectionalLight(0xffd9a0, 1.8);
sun.position.set(60, 120, -40);
scene.add(sun);
const altarGlow = new THREE.PointLight(0xff4400, 800, 120, 1.8);
altarGlow.position.set(0, 14, 40);
scene.add(altarGlow);
const arenaGlow = new THREE.PointLight(0xffa040, 500, 100, 1.8);
arenaGlow.position.set(0, 20, 0);
scene.add(arenaGlow);

// Mars ground plane (v1: flat disc; sculpted terrain is a later layer).
const mars = new THREE.Mesh(
  new THREE.CircleGeometry(500, 64),
  new THREE.MeshStandardMaterial({ color: 0x9c4a26, roughness: 1, metalness: 0 }),
);
mars.rotation.x = -Math.PI / 2;
mars.position.y = -0.05;
scene.add(mars);

// ---------------------------------------------------------------------------
// Ground height (Three.js coords; altar +Z, entrance -Z).
// Dais top 4.0; steps 1.33 / 2.67; arena floor 0.75; ring walkway 0.455;
// arms + diagonal chambers 0.60; hall base 0.20; Mars plane 0.
// ---------------------------------------------------------------------------
function groundHeight(x: number, z: number): number {
  const ax = Math.abs(x);
  if (ax <= 13 && z >= 37.5 && z <= 50.5) return 4.0;
  if (ax <= 9 && z >= 37.2 && z < 39.6) return 2.67;
  if (ax <= 9 && z >= 34.8 && z < 37.2) return 1.33;
  const r2 = x * x + z * z;
  if (r2 <= 40 * 40) return 0.75;
  // Diagonal side chambers: 12x12 pads centered at radius 49.
  for (let k = 0; k < 4; k++) {
    const t = Math.PI / 4 + (k * Math.PI) / 2;
    const dx = Math.cos(t);
    const dz = Math.sin(t);
    const along = x * dx + z * dz;
    const perp = -x * dz + z * dx;
    if (Math.abs(along - 49) <= 6 && Math.abs(perp) <= 6) return 0.6;
  }
  // Cardinal arms: 9 m wide strips from radius 39 to 56.
  if (
    (ax <= 4.5 && Math.abs(z) >= 39 && Math.abs(z) <= 56) ||
    (Math.abs(z) <= 4.5 && ax >= 39 && ax <= 56)
  ) {
    return 0.6;
  }
  if (r2 <= 48 * 48) return 0.455;
  if (r2 <= 56 * 56) return 0.2;
  return 0;
}

// ---------------------------------------------------------------------------
// Player state
// ---------------------------------------------------------------------------
const player = new THREE.Vector3(0, 0, -25); // arena, near the entrance
let eyeY = groundHeight(0, -25) + 1.7;
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
    placeFigure(obj, KING_SCALE, KING_FOOT_OFFSET, KING_ROT_Y, 0, 4.0, 43, 'King');
    markLoaded('King');
  },
  (err) => failLoad('king.glb', err),
);
loadModel('walkthrough/sentinel.glb').then(
  (obj) => {
    // Sentinel in the arena near the entrance (-Z), facing the altar (+Z).
    placeFigure(obj, SENTINEL_SCALE, SENTINEL_FOOT_OFFSET, SENTINEL_ROT_Y, 0, 0.75, -30, 'Sentinel');
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

  // Stay near the action (Mars plane is 500 m; keep the walk to 200 m).
  const rr = Math.hypot(player.x, player.z);
  if (rr > 200) {
    player.x *= 200 / rr;
    player.z *= 200 / rr;
  }

  const targetEye = groundHeight(player.x, player.z) + 1.7;
  eyeY += (targetEye - eyeY) * Math.min(1, dt * 10);
  camera.position.set(player.x, eyeY, player.z);
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;

  renderer.render(scene, camera);
}
animate();
