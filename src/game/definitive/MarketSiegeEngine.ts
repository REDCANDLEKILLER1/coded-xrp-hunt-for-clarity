import type { FreightPoint, FreightPoint3 } from './FreightConvoy';

export const MARKET_SIEGE = { hp: 960, cycle: 18, ventStart: 5.2, ventEnd: 11.5, groundZ: -46, rearY: 2.55, rearZ: -4.8, rearRadius: 1.15 } as const;
export interface SiegeHazard {
  id: number; kind: 'mortar' | 'strip'; from: FreightPoint3; target: FreightPoint3;
  tell: number; age: number; travel: number; duration: number; radius: number;
  /** One impact per actor per committed attack. */
  damaged: Set<string>;
}
export interface SiegePose extends FreightPoint { heading: number }
export interface SiegeAnchors { muzzles: readonly FreightPoint3[]; rear: FreightPoint3 }
const finite = (at: FreightPoint3) => [at.x, at.y, at.z].every(Number.isFinite);

/** Mobile broadside artillery with an exposed rear routing unit. The caller
 * supplies actual current GLB muzzle transforms and owns scene/modal time. */
export class MarketSiegeEngine {
  hp: number = MARKET_SIEGE.hp;
  age = 0;
  readonly hazards: SiegeHazard[] = [];
  private serial = 0;
  private salvo = -1;
  constructor(private readonly anchors: () => SiegeAnchors) {}
  get cycle(): number { return Math.floor(this.age / MARKET_SIEGE.cycle); }
  get phase(): number { return this.age % MARKET_SIEGE.cycle; }
  get open(): boolean { return this.hp > 0 && this.phase >= MARKET_SIEGE.ventStart && this.phase < MARKET_SIEGE.ventEnd; }
  get pose(): SiegePose {
    const base = this.cycle % 2 === 0 ? -9 : 9;
    const moved = Math.max(0, Math.min(1, (this.phase - MARKET_SIEGE.ventEnd) / (16 - MARKET_SIEGE.ventEnd)));
    const turned = Math.max(0, Math.min(1, (this.phase - 16) / 2));
    return { x: base * (1 - 2 * moved), z: MARKET_SIEGE.groundZ, heading: (base < 0 ? Math.PI / 2 : -Math.PI / 2) + turned * Math.PI };
  }
  /** The real elevated GLB node owns collision. Rear-side origin prevents a
   * frontal shot from passing through the armored hull to reach the control. */
  hitRear(origin: FreightPoint3, end: FreightPoint3, damage: number): boolean {
    if (!this.open || !finite(origin) || !finite(end) || !Number.isFinite(damage) || damage <= 0) return false;
    const pose = this.pose, rear = -(origin.x - pose.x) * Math.sin(pose.heading) - (origin.z - pose.z) * Math.cos(pose.heading);
    if (rear < 3) return false;
    const target = this.anchors().rear;
    if (!finite(target)) throw Error('Siege routing control requires its actual finite GLB transform');
    const dx = end.x - origin.x, dy = end.y - origin.y, dz = end.z - origin.z;
    const t = Math.max(0, Math.min(1, ((target.x - origin.x) * dx + (target.y - origin.y) * dy + (target.z - origin.z) * dz) / (dx * dx + dy * dy + dz * dz || 1)));
    if (Math.hypot(origin.x + dx * t - target.x, origin.y + dy * t - target.y, origin.z + dz * t - target.z) > MARKET_SIEGE.rearRadius) return false;
    this.hp = Math.max(0, this.hp - damage);
    if (this.hp === 0) this.hazards.length = 0;
    return true;
  }
  update(dt: number, hero: FreightPoint3, convoy: readonly FreightPoint3[], engaged: boolean): void {
    if (!engaged || this.hp <= 0 || !Number.isFinite(dt) || dt <= 0 || dt > .25 || !finite(hero)) return;
    this.age += dt;
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      const delayed = Math.min(dt, h.tell); h.tell -= delayed; h.age += dt - delayed;
      if (h.age >= h.travel + h.duration) this.hazards.splice(i, 1);
    }
    const ordinal = this.phase >= 3.1 && this.phase < 4.8 ? 1 : this.phase >= 1 && this.phase < 3.1 ? 0 : -1;
    if (ordinal < 0 || this.salvo >= this.cycle * 2 + ordinal || this.hazards.length > 5) return;
    const sources = this.anchors().muzzles;
    if (sources.length !== 4 || !sources.every(finite)) throw Error('Siege artillery requires four actual finite muzzle transforms');
    this.salvo = this.cycle * 2 + ordinal;
    const cargo = convoy.find(finite) ?? hero;
    for (const [i, target] of [hero, cargo].entries()) {
      this.hazards.push({ id: ++this.serial, kind: 'mortar', from: { ...sources[(ordinal * 2 + i) % 4] }, target: { ...target, y: .1 }, tell: 1.35, age: 0, travel: 1.15, duration: .5, radius: 2.25, damaged: new Set() });
    }
    if (ordinal === 1) {
      const from = { ...sources[0], y: .1 }, delta = { x: hero.x - from.x, z: hero.z - from.z }, span = Math.hypot(delta.x, delta.z) || 1;
      const target = { x: from.x + delta.x / span * 24, y: .1, z: from.z + delta.z / span * 24 };
      this.hazards.push({ id: ++this.serial, kind: 'strip', from, target, tell: 1.6, age: 0, travel: 0, duration: .55, radius: 1.15, damaged: new Set() });
    }
  }
}

/** Geometry for the visible shell follows the same committed flight as impact. */
export function siegeShellPosition(h: SiegeHazard): FreightPoint3 {
  if (h.tell > 0) return { ...h.from };
  const t = Math.min(1, h.age / Math.max(.001, h.travel));
  return { x: h.from.x + (h.target.x - h.from.x) * t, y: h.from.y + (h.target.y - h.from.y) * t + Math.sin(Math.PI * t) * 5, z: h.from.z + (h.target.z - h.from.z) * t };
}
export function siegeHazardHit(h: SiegeHazard, actor: string, at: FreightPoint, radius = .6): boolean {
  if (h.tell > 0 || h.age < h.travel || h.age >= h.travel + h.duration || h.damaged.has(actor)
    || !Number.isFinite(at.x) || !Number.isFinite(at.z) || !Number.isFinite(radius) || radius < 0) return false;
  const dx = h.target.x - h.from.x, dz = h.target.z - h.from.z;
  const t = h.kind === 'mortar' ? 1 : Math.max(0, Math.min(1, ((at.x - h.from.x) * dx + (at.z - h.from.z) * dz) / (dx * dx + dz * dz || 1)));
  if (Math.hypot(at.x - h.from.x - dx * t, at.z - h.from.z - dz * t) > h.radius + radius) return false;
  h.damaged.add(actor); return true;
}
