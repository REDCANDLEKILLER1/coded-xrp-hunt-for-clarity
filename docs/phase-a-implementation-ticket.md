# Phase A Implementation Ticket — Data-Driven Content Foundation

**Type:** Implementation ticket (docs-only). **No code is written by this PR.**
**Author:** Claude
**Depends on:** `docs/master-plan-coded-xrp-hunt-for-clarity.md` (PR #6), `docs/phase-2b-asset-inventory.md` (PR #16)
**Gate:** Requires XRPMan approval of this ticket before any code begins.

---

## 1. Goal

Make the current single-ship / single-enemy / single-projectile game **data-driven** without changing how it looks or plays. Today `Game2A` hardcodes content as scattered constants and inline manifest keys. Phase A replaces those with **typed content records** that resolve to manifest keys, so the 63-asset inventory can be added later as *data*, not new code.

Phase A is the **foundation layer only**. It ships zero new gameplay.

---

## 2. Why now

The master plan's core finding: the blocker to the full game is **code structure, not art**. Every later phase (enemy roster, weapon ladder, pickups, bosses) depends on a content layer existing. Phase A builds exactly that and nothing more, so later phases become additive data + small systems instead of risky refactors.

---

## 3. Current state being refactored (grounded in `src/game/core/Game2A.ts`)

Hardcoded values and keys that Phase A will move into content records:

| Today (inline in `Game2A`) | Notes |
|---|---|
| `SPEED = 340`, `BOLT_RATE = 0.14`, `DRONE_RATE = 0.72` | module-level constants |
| player actor `{ w:38, h:42, hp:3 }`, draw size `40×48`, clamp bounds | `newPlayer()` / `movePlayer()` / `drawPlayer()` |
| `this.sprites.draw('ships','player', …)` | hardcoded category/id |
| `this.sprites.draw('enemies','regulator_drone', …)`, drone `{w:28,h:26,hp:1}`, draw `36×36` | `drawDrone()` / `updateDrones()` |
| `this.sprites.draw('projectiles','bb_shot', …)`, bolt `{w:5,h:20}`, draw `8×24`, `vy:-720` | `drawBolt()` / `updateBolts()` |
| `this.sprites.draw('vfx','burst_ring', …)` | `drawRing()` |
| clarity pulse: `special` meter, `ringClock`, radius `165` | drawn procedurally; `special.clarity_pulse` manifest slot exists but is not currently rendered |

These stay **behaviorally identical** after Phase A — only their *source* changes.

---

## 4. Proposed structure (illustrative — not final code)

New directory `src/game/content/` holding typed definitions + a tiny resolver. Sketches below are **specification, to be implemented only after approval**:

```ts
// src/game/content/types.ts  (proposed)
export interface SpriteRef { category: string; id: string; } // resolves via AssetLoader/SpriteRenderer

export interface ShipDef {
  key: string;            // registry id, e.g. "player"
  sprite: SpriteRef;      // { category: "ships", id: "player" }
  draw: { w: number; h: number };
  hitbox: { w: number; h: number };
  speed: number;          // replaces SPEED
  hp: number;             // replaces player hp 3
  fireRate: number;       // replaces BOLT_RATE
  weaponKey: string;      // -> ProjectileDef.key ("bb_shot")
}

export interface EnemyDef {
  key: string;            // "regulator_drone"
  sprite: SpriteRef;
  draw: { w: number; h: number };
  hitbox: { w: number; h: number };
  hp: number;
  baseSpeed: number;      // replaces 105 + wave*8 base
  spawnRate: number;      // replaces DRONE_RATE
  score: number;          // 100
}

export interface ProjectileDef {
  key: string;            // "bb_shot"
  sprite: SpriteRef;
  draw: { w: number; h: number };
  hitbox: { w: number; h: number };
  speed: number;          // 720 (upward)
}

export interface FxDef { key: string; sprite: SpriteRef; }       // burst_ring
export interface SpecialDef { key: string; radius: number; sprite?: SpriteRef; } // clarity_pulse
```

```ts
// src/game/content/registry.ts  (proposed — Phase A populates ONLY current live content)
export const SHIPS: Record<string, ShipDef> = {
  player: { key: "player", sprite: { category: "ships", id: "player" },
            draw: { w: 40, h: 48 }, hitbox: { w: 38, h: 42 },
            speed: 340, hp: 3, fireRate: 0.14, weaponKey: "bb_shot" },
};
export const ENEMIES: Record<string, EnemyDef> = {
  regulator_drone: { key: "regulator_drone", sprite: { category: "enemies", id: "regulator_drone" },
                     draw: { w: 36, h: 36 }, hitbox: { w: 28, h: 26 },
                     hp: 1, baseSpeed: 105, spawnRate: 0.72, score: 100 },
};
export const PROJECTILES: Record<string, ProjectileDef> = {
  bb_shot: { key: "bb_shot", sprite: { category: "projectiles", id: "bb_shot" },
             draw: { w: 8, h: 24 }, hitbox: { w: 5, h: 20 }, speed: 720 },
};
export const FX: Record<string, FxDef> = {
  burst_ring: { key: "burst_ring", sprite: { category: "vfx", id: "burst_ring" } },
};
export const SPECIALS: Record<string, SpecialDef> = {
  clarity_pulse: { key: "clarity_pulse", radius: 165, sprite: { category: "special", id: "clarity_pulse" } },
};
```

> Registries are intentionally seeded with **only the current live content**. The *shape* makes it obvious how the inventory's future keys (`ships.ledger_hawk`, `weapons.lvl2_twin_beam`, etc.) slot in later — but Phase A adds **no** future entries to live play.

The future inventory keys from PR #16 are documented there; Phase A does **not** wire them.

---

## 5. Refactor steps (`Game2A` consumes records)

1. Add `src/game/content/types.ts` and `src/game/content/registry.ts` as above.
2. Replace module constants (`SPEED`, `BOLT_RATE`, `DRONE_RATE`) with reads from `SHIPS.player` / `ENEMIES.regulator_drone`.
3. `newPlayer()` builds from `SHIPS.player` (size, hitbox, hp).
4. `drawPlayer/drawDrone/drawBolt/drawRing` take their `SpriteRef` and draw sizes from the relevant def instead of inline strings/numbers.
5. Spawn/movement/collision read speed, hitbox, score, spawnRate from defs (behavior values unchanged — same numbers, new source).
6. Keep the procedural fallback paths exactly as they are (a missing manifest image still returns `false` from `SpriteRenderer.draw` → procedural art).
7. No change to `AssetLoader`, `Sprite.ts`, `Input`, `Loop`, the manifest, `index.html`, or styles.

This is a **light** refactor: same class, same loop, same draw order — values relocated to typed records.

---

## 6. In scope / out of scope (mirrors PR #16 boundary)

**In scope**
- Content registry definitions + types for the **current live** player, enemy, projectile, FX, and special.
- A resolver pattern so registry IDs map to manifest `category/id` keys.
- Light `Game2A` refactor to consume records.
- Optional: a low-risk smoke test asserting registries are well-formed (see §8).

**Out of scope (do NOT build in Phase A)**
- No ship select. No boss fights. No new enemies in live waves.
- No weapon/upgrade ladder in gameplay. No pickup system in gameplay.
- No asset dump / bulk `public/assets/` import. No manifest edits.
- No new game mode, secrets, env vars, lockfile, or workflow changes.

---

## 7. Acceptance criteria

- Game looks and plays **the same** as post-PR-#16 `main` (title/play/results, movement, fire, drone waves, pulse, scoring, HP, pause, diagnostics).
- All current live slots resolve through **data records**, not scattered hardcoded keys/constants.
- Existing manifest entries still load via `AssetLoader` and render via `SpriteRenderer`.
- Procedural fallback still works when a manifest asset is missing.
- The registry shape makes the future 63-asset mapping obvious (documented, not wired).
- `npm ci` and `npm run build` pass.

---

## 8. Verification plan

- **Build gate:** `npm ci` && `npm run build` green (the merge requirement).
- **Behavior parity (manual / human test):** start → fly → auto-fire → kill drones → score/wave increment → pulse clears nearby drones → take hits → game over → restart. Confirm visuals/feel unchanged.
- **Fallback check:** with manifest images present, real art renders; the procedural path remains intact for misses (verifiable via the diagnostics panel).
- **Optional smoke test:** a tiny test asserting every def has a non-empty `sprite.category`/`sprite.id` and that `SHIPS.player.weaponKey` resolves to a `PROJECTILES` entry. Pure data, no DOM. Only if it stays low-risk and doesn't expand tooling scope.

> The behavior-parity step is a **human/specialist check** (XRPMan) on the running preview — see handoff.

---

## 9. Risks & mitigations

- **Hidden behavior drift** while relocating constants → *Mitigation:* keep every numeric value identical; parity test before merge.
- **Over-engineering into an ECS** → *Mitigation:* explicitly a light refactor; same class/loop; records only.
- **Scope creep into future content** → *Mitigation:* registries seeded with current-live entries only; future keys stay in PR #16 docs.
- **Renderer coupling** (`drawSprite` derives columns from image width) → unchanged in Phase A; sheet metadata stays as-is.
- **No automated tests today** → optional smoke test introduced low-risk; not a gate.

---

## 10. Proposed delivery

- Branch: `claude/phase-a-foundation` (created only after approval).
- One focused PR, code + this ticket referenced; build-gated; merges gated on XRPMan.
- Estimated surface: 2 new small files in `src/game/content/` + edits confined to `Game2A.ts`.

---

## 11. Handoff

- **→ XRPMan:** please approve/adjust this ticket. Two decisions worth your call are listed below.
- **→ GPT:** no asset action needed for Phase A; first real-art swap comes *after* Phase A against the current live slots (per PR #16 §7).

### Open decisions for XRPMan
1. **Optional smoke test** — include the tiny data-validation test in Phase A, or keep Phase A code-only and defer all testing? (Recommend: include it — low risk, starts a test habit.)
2. **`clarity_pulse` sprite** — Phase A can keep the pulse purely procedural (as today) and just *record* the `special.clarity_pulse` slot, or begin drawing the manifest sprite. (Recommend: keep procedural in Phase A; wiring the sprite is a later visual change for your eyes.)

No code will be written until this ticket is approved.
