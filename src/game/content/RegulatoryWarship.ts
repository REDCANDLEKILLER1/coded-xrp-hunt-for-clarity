export type WarshipSystemKey =
  | 'port_battery'
  | 'starboard_battery'
  | 'shield_relay'
  | 'engine_port'
  | 'engine_starboard'
  | 'hangar_defense';

export type WarshipPhase = 'batteries' | 'shield' | 'engines' | 'hangar' | 'disabled';

export interface WarshipSystemDef {
  key: WarshipSystemKey;
  label: string;
  hp: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WarshipSystemState extends WarshipSystemDef {
  remainingHp: number;
  exposed: boolean;
  destroyed: boolean;
}

export const REGULATORY_WARSHIP = {
  key: 'regulatory_warship',
  label: 'REGULATORY WARSHIP',
  sprite: { category: 'bosses', id: 'regulatory_warship' },
  draw: { w: 208, h: 186 },
  score: 2400,
  systems: [
    { key: 'port_battery', label: 'PORT GUN BATTERY', hp: 12, x: -0.29, y: -0.05, w: 34, h: 34 },
    { key: 'starboard_battery', label: 'STARBOARD GUN BATTERY', hp: 12, x: 0.29, y: -0.05, w: 34, h: 34 },
    { key: 'shield_relay', label: 'SHIELD RELAY', hp: 14, x: 0, y: -0.12, w: 38, h: 38 },
    { key: 'engine_port', label: 'PORT ENGINE NODE', hp: 14, x: -0.21, y: 0.32, w: 38, h: 32 },
    { key: 'engine_starboard', label: 'STARBOARD ENGINE NODE', hp: 14, x: 0.21, y: 0.32, w: 38, h: 32 },
    { key: 'hangar_defense', label: 'HANGAR / COMMAND DEFENSE', hp: 18, x: 0, y: 0.1, w: 46, h: 38 },
  ] satisfies WarshipSystemDef[],
} as const;

export class RegulatoryWarshipDirector {
  private systems = new Map<WarshipSystemKey, WarshipSystemState>();
  private shieldExposed = false;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.systems = new Map(
      REGULATORY_WARSHIP.systems.map((system) => [
        system.key,
        { ...system, remainingHp: system.hp, exposed: false, destroyed: false },
      ]),
    );
    this.shieldExposed = false;
    this.refreshExposure();
  }

  exposeShieldWithFogBreaker(): boolean {
    if (this.phase !== 'shield' || this.shieldExposed) return false;
    this.shieldExposed = true;
    this.refreshExposure();
    return true;
  }

  hit(key: WarshipSystemKey, damage: number): { accepted: boolean; destroyedNow: boolean; phase: WarshipPhase } {
    const target = this.systems.get(key);
    if (!target || target.destroyed || !target.exposed || !(damage > 0)) {
      return { accepted: false, destroyedNow: false, phase: this.phase };
    }
    target.remainingHp = Math.max(0, target.remainingHp - damage);
    const destroyedNow = target.remainingHp === 0;
    if (destroyedNow) target.destroyed = true;
    this.refreshExposure();
    return { accepted: true, destroyedNow, phase: this.phase };
  }

  get phase(): WarshipPhase {
    if (!this.isDestroyed('port_battery') || !this.isDestroyed('starboard_battery')) return 'batteries';
    if (!this.isDestroyed('shield_relay')) return 'shield';
    if (!this.isDestroyed('engine_port') || !this.isDestroyed('engine_starboard')) return 'engines';
    if (!this.isDestroyed('hangar_defense')) return 'hangar';
    return 'disabled';
  }

  get targetableSystems(): WarshipSystemState[] {
    return [...this.systems.values()].filter((system) => system.exposed && !system.destroyed).map((system) => ({ ...system }));
  }

  get allSystems(): WarshipSystemState[] {
    return [...this.systems.values()].map((system) => ({ ...system }));
  }

  get objective(): string {
    switch (this.phase) {
      case 'batteries': return 'DISABLE PORT + STARBOARD GUN BATTERIES';
      case 'shield': return this.shieldExposed ? 'DESTROY THE EXPOSED SHIELD RELAY' : 'USE FOG BREAKER TO EXPOSE THE SHIELD RELAY';
      case 'engines': return 'DISABLE BOTH ENGINE NODES';
      case 'hangar': return 'BREAK THE HANGAR / COMMAND DEFENSE';
      case 'disabled': return 'WARSHIP DISABLED // BOARDING WINDOW OPEN';
    }
  }

  private isDestroyed(key: WarshipSystemKey): boolean {
    return this.systems.get(key)?.destroyed ?? false;
  }

  private refreshExposure(): void {
    const phase = this.phase;
    for (const system of this.systems.values()) system.exposed = false;

    if (phase === 'batteries') {
      this.exposeUndestroyed('port_battery');
      this.exposeUndestroyed('starboard_battery');
    } else if (phase === 'shield' && this.shieldExposed) {
      this.exposeUndestroyed('shield_relay');
    } else if (phase === 'engines') {
      this.exposeUndestroyed('engine_port');
      this.exposeUndestroyed('engine_starboard');
    } else if (phase === 'hangar') {
      this.exposeUndestroyed('hangar_defense');
    }
  }

  private exposeUndestroyed(key: WarshipSystemKey): void {
    const system = this.systems.get(key);
    if (system && !system.destroyed) system.exposed = true;
  }
}

export function validateRegulatoryWarship(): string[] {
  const errors: string[] = [];
  const keys = new Set<WarshipSystemKey>();
  for (const system of REGULATORY_WARSHIP.systems) {
    if (keys.has(system.key)) errors.push(`regulatoryWarship.${system.key}: duplicate system key`);
    keys.add(system.key);
    if (!(system.hp > 0)) errors.push(`regulatoryWarship.${system.key}: hp must be > 0`);
    if (!(system.w > 0 && system.h > 0)) errors.push(`regulatoryWarship.${system.key}: hitbox must be positive`);
    if (!(Math.abs(system.x) <= 0.5 && Math.abs(system.y) <= 0.5)) errors.push(`regulatoryWarship.${system.key}: relative position must stay on the ship`);
  }
  if (keys.size !== 6) errors.push('regulatoryWarship: expected six subsystem targets');

  const director = new RegulatoryWarshipDirector();
  if (director.phase !== 'batteries' || director.targetableSystems.length !== 2) errors.push('regulatoryWarship: batteries must be the opening targets');
  return errors;
}
