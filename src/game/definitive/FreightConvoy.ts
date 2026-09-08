import { CONVOY_HULL, initialConvoyCheckpoint, validConvoyCheckpoint, type ConvoyCheckpoint, type ConvoyStage, type FirstFreightLane, type SecondFreightLane } from './ConvoyCheckpoint';
import {freightBoxHit} from './FreightGeometry';

export interface FreightPoint { x: number; z: number }
export interface FreightPoint3 extends FreightPoint { y: number }
export interface HaulerPose extends FreightPoint { heading: number; hull: number }
const p = (x: number, z: number): FreightPoint => ({ x, z });
export const FREIGHT_JUNCTIONS = [p(0, 18), p(0, -10)] as const;
export const FREIGHT_DELIVERY = p(0, -66);
export const FREIGHT_PATHS = {
  apron: [p(0, 36), p(0, 18)],
  express: [p(0, 18), p(0, 5), p(0, -10)],
  covered: [p(0, 18), p(-16, 18), p(-16, -3), p(0, -3), p(0, -10)],
  east: [p(0, -10), p(12, -10), p(12, -28), p(0, -28), p(0, -38)],
  west: [p(0, -10), p(-16, -10), p(-16, -31), p(0, -31), p(0, -38)],
  delivery: [p(0, -38), p(0, -66)],
} as const;
const distance = (a: FreightPoint, b: FreightPoint) => Math.hypot(a.x - b.x, a.z - b.z);
const length = (path: readonly FreightPoint[]) => path.slice(1).reduce((sum, point, index) => sum + distance(path[index], point), 0);
function sample(path: readonly FreightPoint[], traveled: number): Omit<HaulerPose, 'hull'> {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], span = distance(a, b);
    if (traveled <= span || i === path.length - 1) {
      const t = Math.max(0, Math.min(1, traveled / (span || 1)));
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, heading: Math.atan2(b.x - a.x, b.z - a.z) };
    }
    traveled -= span;
  }
  return { ...path[0], heading: Math.PI };
}

/** Two actual haulers follow the chosen freight corridor. The scene owns pause,
 * projectile allegiance, blockades and committing safe-boundary snapshots. */
export class FreightConvoy {
  private safe: ConvoyCheckpoint;
  private path: readonly FreightPoint[];
  private traveled = 0;
  private readonly hp: [number, number];
  private started = false;
  private arrived = false;
  repairCooldown = 0;
  constructor(checkpoint: ConvoyCheckpoint = initialConvoyCheckpoint()) {
    if (!validConvoyCheckpoint(checkpoint)) throw Error('Invalid convoy checkpoint');
    this.safe = structuredClone(checkpoint); this.hp = [...checkpoint.hull];
    this.path = this.pathFor(checkpoint);
    this.started = checkpoint.stage !== 'apron';
    this.arrived = checkpoint.stage === 'delivered';
  }
  private pathFor(c: ConvoyCheckpoint): readonly FreightPoint[] {
    if (c.stage === 'apron') return FREIGHT_PATHS.apron;
    if (c.stage === 'junction_one') return c.first ? FREIGHT_PATHS[c.first] : [FREIGHT_JUNCTIONS[0]];
    if (c.stage === 'junction_two') return c.second ? FREIGHT_PATHS[c.second] : [FREIGHT_JUNCTIONS[1]];
    return c.stage === 'delivered' ? [FREIGHT_DELIVERY] : FREIGHT_PATHS.delivery;
  }
  get checkpoint(): ConvoyCheckpoint { return structuredClone(this.safe); }
  get stage(): ConvoyStage { return this.safe.stage; }
  get failed(): boolean { return this.hp.some(h => h <= 0); }
  get waitingForChoice(): boolean { return this.stage === 'junction_one' && !this.safe.first || this.stage === 'junction_two' && !this.safe.second; }
  get waitingForCommit(): boolean { return this.arrived && this.stage !== 'delivered'; }
  get poses(): readonly HaulerPose[] {
    // Append a eight metre straight approach behind a newly reconstructed boundary.
    // The second hauler remains physically separate even at a waiting junction.
    const previous = this.stage === 'junction_one' ? FREIGHT_PATHS.apron
      : this.stage === 'junction_two' ? FREIGHT_PATHS[this.safe.first!]
      : this.stage === 'siege' ? FREIGHT_PATHS[this.safe.second!]
      : FREIGHT_PATHS.delivery;
    const start = this.path[0], end = previous[previous.length - 1], tailStart = length(previous) - 8;
    const tail: FreightPoint[] = [sample(previous, tailStart)]; let progress = 0;
    for (let i = 1; i < previous.length - 1; i++) {
      progress += distance(previous[i - 1], previous[i]);
      if (progress > tailStart) tail.push(previous[i]);
    }
    const extended = [...tail.map(at => p(at.x + start.x - end.x, at.z + start.z - end.z)), ...this.path];
    return this.hp.map((hull, index) => ({ ...sample(extended, this.traveled + 8 - index * 8), hull }));
  }
  start(apronClear: boolean): boolean {
    if (!apronClear || this.stage !== 'apron' || this.failed) return false;
    this.started = true; return true;
  }
  choose(lane: FirstFreightLane | SecondFreightLane): ConvoyCheckpoint | null {
    if (this.failed || !this.waitingForChoice) return null;
    const candidate = this.checkpoint;
    if (this.stage === 'junction_one' && (lane === 'express' || lane === 'covered')) candidate.first = lane;
    else if (this.stage === 'junction_two' && (lane === 'east' || lane === 'west')) candidate.second = lane;
    else return null;
    candidate.hull = [...this.hp]; return candidate;
  }
  /** Call only after saving the exact offered checkpoint successfully. */
  accept(checkpoint: ConvoyCheckpoint): void {
    if (!validConvoyCheckpoint(checkpoint)) throw Error('Invalid convoy boundary');
    this.safe = structuredClone(checkpoint); this.hp[0] = checkpoint.hull[0]; this.hp[1] = checkpoint.hull[1];
    this.path = this.pathFor(checkpoint); this.traveled = 0; this.started = true; this.arrived = checkpoint.stage === 'delivered';
  }
  update(dt: number, hero: FreightPoint, blocked: (at: FreightPoint) => boolean, siegeDefeated: boolean): void {
    if (!Number.isFinite(dt) || dt <= 0 || dt > .25) return;
    this.repairCooldown = Math.max(0, this.repairCooldown - dt);
    if (!this.started || this.failed || this.arrived || this.waitingForChoice || this.stage === 'siege' && !siegeDefeated) return;
    const poses = this.poses;
    if (poses.some(at => blocked(at)) || Math.min(...poses.map(at => distance(hero, at))) > 18) return;
    this.traveled = Math.min(length(this.path), this.traveled + dt * 2.35);
    // The boundary is a ten metre staging bay; the rear vehicle remains eight
    // metres behind the leader instead of collapsing onto the same endpoint.
    this.arrived = this.traveled >= length(this.path) && this.poses.every(at => distance(at, this.path[this.path.length - 1]) <= 10);
  }
  boundary(cleared: readonly string[]): ConvoyCheckpoint | null {
    if (!this.waitingForCommit || this.failed) return null;
    const stage: ConvoyStage = this.stage === 'apron' ? 'junction_one' : this.stage === 'junction_one' ? 'junction_two' : this.stage === 'junction_two' ? 'siege' : 'delivered';
    const candidate = { ...this.checkpoint, stage, hull: [...this.hp] as [number, number], cleared: [...new Set([...this.safe.cleared, ...cleared])] };
    return validConvoyCheckpoint(candidate) ? candidate : null;
  }
  repair(index: number, hero: FreightPoint, unlocked: boolean, logisticsModule = false): boolean {
    if (!unlocked || this.failed || this.repairCooldown > 0 || !Number.isInteger(index) || index < 0 || index > 1
      || this.hp[index] >= CONVOY_HULL || distance(hero, this.poses[index]) > 3.3) return false;
    this.hp[index] = Math.min(CONVOY_HULL, this.hp[index] + 35); this.repairCooldown = logisticsModule ? 10 : 18; return true;
  }
  firstHit(from:FreightPoint3,to:FreightPoint3):{index:number;t:number}|null{
    let nearest: { index: number; t: number } | null = null;
    for (const [index, pose] of this.poses.entries()) {
      const t=freightBoxHit(from,to,pose,1.15,.15,2.3,2.3);
      if(t!==null&&(!nearest||t<nearest.t))nearest={index,t};
    }
    return nearest;
  }
  /** Swept three-dimensional local boxes keep shots above/beside the cargo clear. */
  hit(from: FreightPoint3, to: FreightPoint3, damage: number): number | null {
    if (this.failed || !Number.isFinite(damage) || damage <= 0) return null;
    const nearest=this.firstHit(from,to);
    if (!nearest) return null;
    this.hp[nearest.index] = Math.max(0, this.hp[nearest.index] - damage); return nearest.index;
  }
  blast(index:number,damage:number):boolean{
    if(this.failed||!Number.isInteger(index)||index<0||index>1||!Number.isFinite(damage)||damage<=0)return false;
    this.hp[index]=Math.max(0,this.hp[index]-damage);return true;
  }
}
