// Cloud descent phase (PR #133): the 40-second playable descent through the
// cloud layer between the Earth-entry cinematic and Ledger City combat.
//
// Extraction #1 of the Game2A decomposition (Phase 0). Game2A remains the
// orchestrator: it owns the shared combat/render systems and the mode flags,
// and delegates the descent state machine here. Everything the descent needs
// from Game2A arrives through the DescentHost interface below -- this module
// never imports Game2A, so the dependency points one way.

import { CLOUD_DESCENT_DURATION } from '../content/EarthEnvironment';
import { EarthFlightEncounterDirector } from '../content/EarthFlightEncounters';
import type { Vec2 } from './Types';

export interface Circle { cx: number; cy: number; r: number; }

/** Everything the descent phase needs from its Game2A host. */
export interface DescentHost {
  // -- input ---------------------------------------------------------------
  consumePause(): boolean;
  consumeTap(): Vec2 | null;
  consumeBomb(): boolean;
  consumeSpecial(): boolean;
  consumeDoubleTap(): Vec2 | null;
  setInputActive(active: boolean): void;
  storyCapturedInput(): boolean;
  setStoryCapturedInput(captured: boolean): void;
  // -- touch zones -----------------------------------------------------------
  pauseZone(): Circle;
  bombZone(): Circle;
  specialZone(): Circle;
  inControls(x: number, y: number): boolean;
  markBombHint(): void;
  // -- shared combat systems (owned by Game2A, driven by the descent) --------
  useBomb(): void;
  useSpecial(): void;
  movePlayer(dt: number): void;
  updateFacing(dt: number): void;
  updateBolts(dt: number): void;
  updateSeekers(dt: number): void;
  moveDrones(dt: number): void;
  updateCombatLifecycle(dt: number): void;
  spawnMissionDrone(enemyKey: string, xRatio: number): void;
  blockFighterArmory(): void;
  // -- game state ------------------------------------------------------------
  isPlaying(): boolean;
  isPaused(): boolean;
  setPaused(paused: boolean): void;
  addClock(dt: number): void;
  droneCount(): number;
  // -- city handoff ------------------------------------------------------------
  setCityPathPosition(v: number): void;
  currentActKey(): string;
  startCityDirector(actKey: string): void;
  setMissionBanner(text: string, clock: number): void;
  pendingUpgrades(): number;
  openUpgradeChoice(): void;
}

function inCircle(circle: Circle, x: number, y: number): boolean {
  const dx = x - circle.cx, dy = y - circle.cy;
  return dx * dx + dy * dy <= circle.r * circle.r;
}

export class CloudDescent {
  /** Descent clock in seconds; null when the descent is not running. */
  elapsed: number | null = null;
  /** True after a completed descent until the run resets (cloud backdrop tail). */
  hasCloudTail = false;
  readonly director = new EarthFlightEncounterDirector();

  constructor(private readonly host: DescentHost) {}

  get active(): boolean { return this.elapsed !== null; }

  get progress(): number {
    return this.elapsed === null ? 0 : this.elapsed / CLOUD_DESCENT_DURATION;
  }

  /** Begin the descent (called when the Earth-entry cinematic completes). */
  start(): void {
    this.elapsed = 0;
    this.director.start('cloud_descent');
  }

  /** Abort the descent without the city handoff (e.g. the run ended). */
  clear(): void {
    this.elapsed = null;
    this.director.clear();
  }

  /** Full reset: abort the descent and drop the cloud tail. */
  reset(): void {
    this.clear();
    this.hasCloudTail = false;
  }

  /**
   * Run one descent frame: input routing, pause, combat ticks, encounter
   * pacing, the descent clock, and the city handoff at 40s.
   * Mirrors the pre-extraction Game2A.frame() descent branch exactly.
   */
  update(dt: number): void {
    const h = this.host;
    h.blockFighterArmory();
    if (h.storyCapturedInput()) { h.setInputActive(true); h.setStoryCapturedInput(false); }
    if (h.consumePause()) h.setPaused(!h.isPaused());
    const tap = h.consumeTap();
    if (tap && inCircle(h.pauseZone(), tap.x, tap.y)) h.setPaused(!h.isPaused());
    if (!h.isPaused() && h.isPlaying()) {
      h.addClock(dt);
      if (tap) {
        if (inCircle(h.bombZone(), tap.x, tap.y)) h.useBomb();
        else if (inCircle(h.specialZone(), tap.x, tap.y)) h.useSpecial();
      }
      // Combat is live during the descent: bombs/specials fire, guns
      // auto-fire via updateBolts, and the descent director paces waves.
      if (h.consumeSpecial()) h.useSpecial();
      if (h.consumeBomb()) h.useBomb();
      const doubleTap = h.consumeDoubleTap();
      if (doubleTap && !h.inControls(doubleTap.x, doubleTap.y)) { h.markBombHint(); h.useBomb(); }
      this.elapsed = Math.min(CLOUD_DESCENT_DURATION, (this.elapsed ?? 0) + dt);
      h.movePlayer(dt);
      h.updateFacing(dt);
      this.updateEncounters(dt);
      h.updateBolts(dt);
      h.updateSeekers(dt);
      h.moveDrones(dt);
      h.updateCombatLifecycle(dt);
      if (!h.isPlaying()) { this.clear(); return; }
      if ((this.elapsed ?? 0) >= CLOUD_DESCENT_DURATION) this.completeHandoff();
    } else {
      // Paused: drain combat inputs so they cannot fire on resume.
      h.consumeBomb(); h.consumeDoubleTap(); h.consumeSpecial();
    }
  }

  /**
   * Cloud descent encounters: airborne drones only, paced by the director.
   * Ground hazards/turrets stay city-gated -- the descent spawns no hazards.
   */
  private updateEncounters(dt: number): void {
    const state = this.director.update(dt, this.host.droneCount());
    for (const spawn of state.spawns) {
      if (spawn.kind === 'enemy') this.host.spawnMissionDrone(spawn.enemyKey, spawn.x);
    }
  }

  /**
   * City handoff: surviving drones carry into the city without clearing or
   * duplicating waves; pending upgrades stay banked until the choice opens.
   */
  private completeHandoff(): void {
    const h = this.host;
    this.elapsed = null;
    h.setCityPathPosition(0);
    this.hasCloudTail = true;
    this.director.clear();
    h.startCityDirector(h.currentActKey());
    h.setMissionBanner('CLOUD LAYER CLEARED // LEDGER CITY', 2.8);
    if (h.pendingUpgrades() > 0) h.openUpgradeChoice();
  }
}
