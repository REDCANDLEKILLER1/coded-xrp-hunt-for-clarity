// Arena.ts — isolated 3D test arena for the turn-based combat system.
//
// Flat arena, free-position with range bands (no grid), simple primitive
// meshes (no .glb loading — the arena must boot with zero model fetches).
// DOM overlay UI: action buttons, HP bars, turn indicator, battle log.
//
// This is a scaffold: playable in isolation (player vs one test enemy).
// It does NOT touch Game2A.ts, Space3DGame.ts, or any existing scene.

import {
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  FogExp2,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import {
  ActionDef,
  Combatant,
  canUseAction,
  createCombatant,
  distance,
  playerActions,
  rangeBand,
  testEnemyActions,
} from './Actions.ts';
import { TurnEngine } from './TurnEngine.ts';
import { ArenaLocation, WARSHIP_BRIDGE } from './Locations.ts';

/** Enemy AI states. Simple and explicit for the scaffold. */
type EnemyState = 'idle' | 'aggro' | 'attack' | 'special';

interface ArenaFighter {
  combatant: Combatant;
  mesh: Group;
  bodyMat: MeshStandardMaterial;
  hpBar: HTMLDivElement;
  hpFill: HTMLDivElement;
  label: HTMLDivElement;
}

const ARENA_RADIUS = 14;
const MELEE_RANGE = 3.5;

export class TurnArena {
  private readonly container: HTMLElement;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(50, 1, 0.1, 200);
  private readonly ui = document.createElement('div');
  private readonly actionBar = document.createElement('div');
  private readonly turnBanner = document.createElement('div');
  private readonly battleLog = document.createElement('div');
  private readonly endCard = document.createElement('div');
  private engine: TurnEngine | null = null;
  private fighters = new Map<string, ArenaFighter>();
  private enemyState: EnemyState = 'idle';
  private raf = 0;
  private readonly lifetime = new AbortController();
  private cameraGoal = new Vector3(0, 14, 16);
  private animClock = 0;
  private lunge: { mesh: Group; t: number; from: Vector3; to: Vector3 } | null = null;
  private location: ArenaLocation;
  private readonly locationLabel = document.createElement('div');
  /** Optional callback fired once when the battle ends. Set by authored encounters. */
  onBattleEnd: ((result: 'victory' | 'defeat') => void) | null = null;
  private battleEndFired = false;

  constructor(container: HTMLElement, location: ArenaLocation = WARSHIP_BRIDGE) {
    this.container = container;
    this.location = location;
    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, 2));
    container.appendChild(this.renderer.domElement);
    this.buildScene();
    this.buildUI();
    this.resize();
    window.addEventListener('resize', () => this.resize(), {
      signal: this.lifetime.signal,
    });
  }

  // ---- scene setup -------------------------------------------------------

  private buildScene(): void {
    const L = this.location;
    this.scene.background = new Color(L.background);
    this.scene.fog = new FogExp2(L.fogColor, L.fogDensity);
    this.scene.add(new AmbientLight(L.ambientColor, L.ambientIntensity));
    const sun = new DirectionalLight(L.keyLightColor, L.keyLightIntensity);
    sun.position.set(8, 14, 6);
    this.scene.add(sun);
    const rim = new DirectionalLight(L.accentColor, 0.9);
    rim.position.set(-10, 6, -8);
    this.scene.add(rim);

    // Floor in the location's palette.
    const floor = new Mesh(
      new PlaneGeometry(ARENA_RADIUS * 2.4, ARENA_RADIUS * 2.4),
      new MeshStandardMaterial({ color: L.floorColor, roughness: 0.95 }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    // Painted range rings in the location's accent palette.
    const [meleeC, shortC, longC] = L.ringColors;
    const ring = (r: number, color: string) => {
      const g = new PlaneGeometry(r * 2, r * 2);
      const tex = new CanvasTexture(ringTexture(r, color));
      const m = new Mesh(
        g,
        new MeshStandardMaterial({
          map: tex,
          transparent: true,
          roughness: 1,
          depthWrite: false,
        }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.02;
      this.scene.add(m);
    };
    ring(MELEE_RANGE, meleeC);
    ring(9, shortC);
    ring(15, longC);

    // Location props: consoles, pillars, crates — the room matches the fight.
    for (const p of L.props) {
      const mat = new MeshStandardMaterial({
        color: p.color,
        roughness: 0.7,
        metalness: 0.35,
        emissive: new Color(p.emissive ?? 0x000000),
        emissiveIntensity: p.emissive ? 0.7 : 0,
      });
      let mesh: Mesh;
      if (p.kind === 'tank') {
        mesh = new Mesh(new CylinderGeometry(p.w / 2, p.w / 2, p.h, 12), mat);
        mesh.position.y = p.h / 2;
      } else if (p.kind === 'arch') {
        // Arch: two posts + a lintel.
        const grp = new Group();
        const postG = new BoxGeometry(1.2, p.h, p.d);
        const left = new Mesh(postG, mat);
        left.position.set(-p.w / 2, p.h / 2, 0);
        const right = new Mesh(postG, mat);
        right.position.set(p.w / 2, p.h / 2, 0);
        const lintel = new Mesh(new BoxGeometry(p.w + 1.2, 1.2, p.d), mat);
        lintel.position.set(0, p.h, 0);
        grp.add(left, right, lintel);
        grp.position.set(p.x, 0, p.z);
        this.scene.add(grp);
        continue;
      } else {
        mesh = new Mesh(new BoxGeometry(p.w, p.h, p.d), mat);
        mesh.position.y = p.h / 2;
      }
      mesh.position.x = p.x;
      mesh.position.z = p.z;
      this.scene.add(mesh);
    }

    // Location nameplate.
    this.locationLabel.textContent = L.name.toUpperCase();
    this.locationLabel.style.cssText =
      'position:absolute;top:12px;left:14px;font-size:11px;letter-spacing:.18em;' +
      'opacity:.75;pointer-events:none;';

    this.camera.position.copy(this.cameraGoal);
    this.camera.lookAt(0, 1, 0);
  }

  private buildUI(): void {
    const ui = this.ui;
    ui.style.cssText =
      'position:absolute;inset:0;pointer-events:none;font-family:system-ui,sans-serif;color:#e8eefc;';
    this.container.style.position = 'relative';
    this.container.appendChild(ui);

    this.turnBanner.style.cssText =
      'position:absolute;top:12px;left:50%;transform:translateX(-50%);' +
      'background:rgba(10,16,32,.82);border:1px solid #3a4a6b;border-radius:8px;' +
      'padding:8px 18px;font-size:15px;letter-spacing:.06em;';
    ui.appendChild(this.turnBanner);

    this.actionBar.style.cssText =
      'position:absolute;bottom:14px;left:50%;transform:translateX(-50%);' +
      'display:flex;gap:10px;pointer-events:auto;';
    ui.appendChild(this.actionBar);

    this.battleLog.style.cssText =
      'position:absolute;top:64px;right:12px;width:250px;max-height:40%;overflow:hidden;' +
      'background:rgba(10,16,32,.72);border:1px solid #2a3a5b;border-radius:8px;' +
      'padding:8px 10px;font-size:12px;line-height:1.5;';
    ui.appendChild(this.battleLog);

    this.endCard.style.cssText =
      'position:absolute;inset:0;display:none;align-items:center;justify-content:center;' +
      'background:rgba(4,8,18,.72);pointer-events:auto;';
    ui.appendChild(this.endCard);
    ui.appendChild(this.locationLabel);
  }

  private resize(): void {
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---- battle setup ------------------------------------------------------

  /** Switch the arena to a different location (rebuilds scenery). */
  setLocation(location: ArenaLocation): void {
    this.location = location;
    this.scene.clear();
    this.buildScene();
  }

  /** Start a battle, optionally in a specific location. */
  startBattle(location?: ArenaLocation): void {
    if (location && location.id !== this.location.id) this.setLocation(location);
    this.clearFighters();
    const player = createCombatant({
      id: 'player',
      name: 'Pilot',
      team: 'player',
      maxHp: 100,
      attack: 8,
      defense: 4,
      speed: 12,
      x: -6,
      z: 0,
      actions: playerActions(),
    });
    const enemy = createCombatant({
      id: 'dummy',
      name: 'Rogue Drone',
      team: 'enemy',
      maxHp: 70,
      attack: 7,
      defense: 2,
      speed: 9,
      x: 6,
      z: 0,
      actions: testEnemyActions(),
    });
    this.startBattleWith([player, enemy]);
  }

  /**
   * Start a battle with custom combatants (already created via createCombatant).
   * Used by authored encounters like the lunar base capture.
   */
  startBattleWith(combatants: Combatant[], location?: ArenaLocation): void {
    if (location && location.id !== this.location.id) this.setLocation(location);
    this.clearFighters();
    this.battleEndFired = false;
    this.engine = new TurnEngine(combatants);
    for (const c of combatants) {
      const color = c.team === 'player' ? 0x4da3ff : c.id === 'commander' ? 0xff8a3d : 0xff5a5a;
      this.addFighter(c, color);
      if (c.team === 'player' && !c.items.has('stem_pack')) c.items.set('stem_pack', 1);
    }
    this.enemyState = 'idle';
    this.engine.start();
    this.pushLog(this.engine.log.splice(0).join('<br>'));
    this.refreshUI();
    this.loop();
  }

  private addFighter(c: Combatant, color: number): void {
    const g = new Group();
    const bodyMat = new MeshStandardMaterial({ color, roughness: 0.6 });
    const body = new Mesh(new CapsuleGeometry(0.7, 1.4, 6, 12), bodyMat);
    body.position.y = 1.4;
    g.add(body);
    const head = new Mesh(new BoxGeometry(0.9, 0.5, 0.9), bodyMat);
    head.position.y = 2.6;
    g.add(head);
    g.position.set(c.x, 0, c.z);
    this.scene.add(g);

    const label = document.createElement('div');
    label.textContent = c.name;
    label.style.cssText =
      'position:absolute;transform:translate(-50%,-130%);font-size:12px;' +
      'background:rgba(10,16,32,.7);padding:2px 8px;border-radius:6px;white-space:nowrap;';
    const hpBar = document.createElement('div');
    hpBar.style.cssText =
      'position:absolute;transform:translate(-50%,-90%);width:90px;height:8px;' +
      'background:rgba(0,0,0,.55);border:1px solid #3a4a6b;border-radius:4px;';
    const hpFill = document.createElement('div');
    hpFill.style.cssText =
      'height:100%;width:100%;border-radius:3px;background:#5aff8a;';
    hpBar.appendChild(hpFill);
    this.ui.appendChild(label);
    this.ui.appendChild(hpBar);
    this.fighters.set(c.id, { combatant: c, mesh: g, bodyMat, hpBar, hpFill, label });
  }

  private clearFighters(): void {
    for (const f of this.fighters.values()) {
      this.scene.remove(f.mesh);
      f.label.remove();
      f.hpBar.remove();
    }
    this.fighters.clear();
    this.endCard.style.display = 'none';
    this.endCard.innerHTML = '';
  }

  // ---- UI ----------------------------------------------------------------

  private refreshUI(): void {
    const engine = this.engine;
    if (!engine) return;
    const state = engine.state();
    const cur = state.currentId ? engine.getCombatant(state.currentId) : null;

    this.turnBanner.textContent = cur
      ? `Round ${state.round} — ${cur.name}'s turn`
      : state.result === 'victory'
        ? 'Victory!'
        : 'Defeat...';

    // Action buttons for the player's turn only.
    this.actionBar.innerHTML = '';
    if (cur && cur.team === 'player' && cur.alive) {
      for (const a of cur.actions) {
        const btn = document.createElement('button');
        const ready = canUseAction(cur, a.id);
        const cd = cur.cooldowns.get(a.id) ?? 0;
        btn.textContent = cd > 0 ? `${a.name} (${cd})` : a.name;
        btn.title = a.description;
        btn.disabled = !ready;
        btn.style.cssText =
          'padding:10px 16px;font-size:14px;border-radius:8px;cursor:pointer;' +
          'background:#1d2c4e;color:#e8eefc;border:1px solid #3a4a6b;' +
          (ready ? '' : 'opacity:.45;cursor:default;');
        btn.addEventListener(
          'click',
          () => this.onPlayerAction(a),
          { signal: this.lifetime.signal },
        );
        this.actionBar.appendChild(btn);
      }
    }

    // HP bars + floating labels follow their fighters.
    for (const f of this.fighters.values()) {
      const c = f.combatant;
      const pct = Math.max(0, (c.hp / c.maxHp) * 100);
      f.hpFill.style.width = `${pct}%`;
      f.hpFill.style.background = pct > 50 ? '#5aff8a' : pct > 25 ? '#ffb84d' : '#ff5a5a';
      const v = new Vector3(c.x, 3.4, c.z).project(this.camera);
      const w = this.container.clientWidth || 800;
      const h = this.container.clientHeight || 600;
      const sx = (v.x * 0.5 + 0.5) * w;
      const sy = (-v.y * 0.5 + 0.5) * h;
      f.label.style.left = `${sx}px`;
      f.label.style.top = `${sy}px`;
      f.hpBar.style.left = `${sx}px`;
      f.hpBar.style.top = `${sy + 14}px`;
      f.mesh.position.x += (c.x - f.mesh.position.x) * 0.2;
      f.mesh.position.z += (c.z - f.mesh.position.z) * 0.2;
      f.bodyMat.emissive = new Color(c.alive ? 0x000000 : 0x330000);
    }

    if (state.result !== 'ongoing') this.showEndCard(state.result);
  }

  private pushLog(html: string): void {
    if (!html) return;
    const div = document.createElement('div');
    div.innerHTML = html;
    this.battleLog.prepend(div);
    while (this.battleLog.children.length > 12) {
      this.battleLog.lastChild?.remove();
    }
  }

  private showEndCard(result: 'victory' | 'defeat' | 'ongoing'): void {
    if (result === 'ongoing') return;
    this.endCard.style.display = 'flex';
    this.endCard.innerHTML =
      `<div style="text-align:center;background:#101a30;border:1px solid #3a4a6b;` +
      `border-radius:12px;padding:32px 48px;">` +
      `<h2 style="margin:0 0 8px;">${result === 'victory' ? 'Victory!' : 'Defeat'}</h2>` +
      `<p style="opacity:.7;margin:0 0 16px;">Test arena complete.</p>` +
      `<button id="tb-rematch" style="padding:10px 22px;font-size:15px;border-radius:8px;` +
      `cursor:pointer;background:#1d2c4e;color:#e8eefc;border:1px solid #3a4a6b;">Rematch</button></div>`;
    document
      .getElementById('tb-rematch')
      ?.addEventListener('click', () => this.startBattle(), {
        signal: this.lifetime.signal,
      });
  }

  // ---- player input ------------------------------------------------------

  private onPlayerAction(action: ActionDef): void {
    const engine = this.engine;
    if (!engine) return;
    const actor = engine.current();
    if (!actor || actor.team !== 'player') return;

    // Self-targeted abilities need no target.
    let targetId: string | null = null;
    if (action.range > 0) {
      const foe = [...this.fighters.values()].find(
        (f) => f.combatant.team === 'enemy' && f.combatant.alive,
      );
      if (!foe) return;
      targetId = foe.combatant.id;
    }
    const outcome = engine.executeAction(action.id, targetId);
    if (!outcome.ok) {
      this.pushLog(outcome.reason ?? 'Action failed.');
      return;
    }
    this.pushLog(outcome.log.join('<br>'));
    if (targetId) this.playLunge(actor.id, targetId);
    this.advance();
  }

  private advance(): void {
    const engine = this.engine;
    if (!engine) return;
    const state = engine.endTurn();
    this.pushLog(engine.log.splice(0).join('<br>'));
    this.refreshUI();
    // Fire the battle-end callback once when the battle concludes.
    if (state.result !== 'ongoing' && !this.battleEndFired) {
      this.battleEndFired = true;
      this.showEndCard(state.result);
      this.onBattleEnd?.(state.result);
      return;
    }
    // Enemy acts automatically after a short beat.
    if (state.result === 'ongoing' && state.currentId) {
      const cur = engine.getCombatant(state.currentId);
      if (cur && cur.team === 'enemy') {
        window.setTimeout(() => this.enemyTurn(), 650);
      }
    }
  }

  // ---- enemy AI: idle -> aggro -> attack -> special on cooldown -----------

  private enemyTurn(): void {
    const engine = this.engine;
    if (!engine) return;
    const foe = engine.current();
    if (!foe || foe.team !== 'enemy' || !foe.alive) return;
    const player = engine.getCombatant('player');
    if (!player || !player.alive) return;

    const d = distance(foe, player);
    const band = rangeBand(d);

    // State transitions.
    if (this.enemyState === 'idle') {
      this.enemyState = 'aggro';
      this.pushLog(`${foe.name} locks onto you!`);
    }

    // Simple movement: close distance if out of melee for the basic attack.
    // Free-position: step toward the player, capped per turn.
    if (band !== 'melee' && d > MELEE_RANGE) {
      const step = Math.min(4, d - 2.5);
      const dx = player.x - foe.x;
      const dz = player.z - foe.z;
      const len = Math.max(0.001, Math.hypot(dx, dz));
      foe.x += (dx / len) * step;
      foe.z += (dz / len) * step;
      this.pushLog(`${foe.name} advances (${rangeBand(distance(foe, player))} range).`);
    }

    // Action selection: special when ready and in range, else basic attack.
    const special = foe.actions.find((a) => a.id === 'savage_roar');
    const basic = foe.actions.find((a) => a.id === 'claw');
    const nowD = distance(foe, player);
    let chosen: ActionDef | undefined;
    if (special && canUseAction(foe, special.id) && nowD <= special.range) {
      chosen = special;
      this.enemyState = 'special';
    } else if (basic && nowD <= basic.range) {
      chosen = basic;
      this.enemyState = 'attack';
    }

    if (chosen) {
      const outcome = engine.executeAction(chosen.id, player.id);
      this.pushLog(outcome.log.join('<br>'));
      this.playLunge(foe.id, player.id);
    } else {
      this.pushLog(`${foe.name} repositions, unable to strike.`);
    }
    this.advance();
  }

  private playLunge(fromId: string, toId: string): void {
    const a = this.fighters.get(fromId);
    const b = this.fighters.get(toId);
    if (!a || !b) return;
    this.lunge = {
      mesh: a.mesh,
      t: 0,
      from: a.mesh.position.clone(),
      to: new Vector3(
        (a.mesh.position.x + b.mesh.position.x) / 2,
        0,
        (a.mesh.position.z + b.mesh.position.z) / 2,
      ),
    };
  }

  // ---- render loop -------------------------------------------------------

  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop);
    this.animClock += 0.016;

    // Idle bob for alive fighters.
    for (const f of this.fighters.values()) {
      if (f.combatant.alive) {
        f.mesh.position.y = Math.sin(this.animClock * 2 + f.combatant.x) * 0.08;
        f.mesh.rotation.y += 0.004;
      }
    }
    // Attack lunge animation.
    if (this.lunge) {
      const L = this.lunge;
      L.t += 0.08;
      if (L.t >= 1) {
        L.mesh.position.copy(L.from);
        this.lunge = null;
      } else {
        const k = Math.sin(L.t * Math.PI);
        L.mesh.position.lerpVectors(L.from, L.to, k);
      }
    }
    // Camera slowly orbits the arena center for a cinematic feel.
    const t = this.animClock * 0.08;
    this.cameraGoal.set(Math.sin(t) * 17, 13, Math.cos(t) * 17);
    this.camera.position.lerp(this.cameraGoal, 0.03);
    this.camera.lookAt(0, 1, 0);

    this.refreshUI();
    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.lifetime.abort();
    this.scene.clear();
    this.renderer.dispose();
    this.ui.remove();
    this.renderer.domElement.remove();
  }
}

/** Painted ring texture for the range bands. */
function ringTexture(radius: number, color: string): HTMLCanvasElement {
  const s = 256;
  const cv = document.createElement('canvas');
  cv.width = s;
  cv.height = s;
  const ctx = cv.getContext('2d');
  if (!ctx) return cv;
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s / 2 - 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.16;
  ctx.lineWidth = 1;
  for (let r = s / 2 - 12; r > 8; r -= 10) {
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  void radius;
  return cv;
}
