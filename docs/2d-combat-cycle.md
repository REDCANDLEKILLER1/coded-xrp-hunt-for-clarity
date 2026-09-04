# The 2D combat cycle

Design for the next block of work on the top-down half of the game: the player
weapon ladder, the four boss fights, the ground layer, the pickups, and the
effects that tell you what just happened.

The on-foot interior is discontinued. The shape of the game is now **2D
top-down fight → board the boss ship at the end of world one → 3D cockpit**.
Everything below is the 2D half. The 3D destroyer battery (four hardpoints,
side and front muzzle origins, converging fire, hold-to-fire) stays a separate
cycle.

This is a plan, not a change. Nothing here is implemented yet.

---

## 0. How this was arrived at

Six readers mapped the shipped code — weapons, bosses, ground, effects, assets,
and the playtest record — citing `file:line` for every fact. Five designers then
worked the same brief from different angles (arcade, boss director, theme,
mobile feel, systems). Three judges scored all five on fun, fit with the locked
PR order, asset-rule compliance, boss efficiency, mobile readability, theme, and
reviewability.

| lens | score (3 judges) |
| --- | ---: |
| **theme-first** | **178** |
| systems / economy | 158 |
| mobile feel | 156 |
| arcade classic | 150 |
| boss director | 149 |

All three judges independently named theme-first the winner. This document is
that proposal with the ideas the judges asked to graft in from the other four,
and the ideas they asked to drop taken out. Where a judge overruled the winner,
it is marked **[graft]** or **[dropped]** so the reasoning stays visible.

---

## 1. The bug under Ryan's 87-second fight

Ryan fought the Regulatory Behemoth for 87 seconds in phase 2. The escort count
climbed 4 → 10 and the health bar barely moved. Three defects compound, and all
three are verified in the shipped code on `main`:

**Escorts are frozen.** `moveDrones(dt)` is called from exactly two places:
`updateAuthoredFlight` (`Game2A.ts:930`) and `updateDrones` (`:1253`). The
update loop takes the boss branch *instead* of `updateDrones` (`:645-655`), so
while a boss is alive no drone is ever simulated. Escorts do not fly to station,
do not fire, do not dodge, and do not flee. They sit where they spawned.

**`ESCORT_PATIENCE` is dead code.** Patience is decremented at `:1307`, inside
`moveDrones`. Since `moveDrones` never runs during a boss, the 16-second timeout
never fires. The comment at `:1813` promising the fight "can never deadlock
behind a stray escort" is false, and `validate-boss-script.mjs:128-131` checks
only that the constant is *mentioned* in the source.

**Launches are uncapped.** `launchEscorts` pushes `ESCORT_COUNT` drones every
time the script reaches `escort_screen`, with no check for escorts already
alive. Behemoth phase 2 cycles that script every 3.92 s. The shield blocks 100%
of damage (`bossDamageScale` returns 0) until every non-fleeing escort is dead.
Four overlapping launches is 20 live escorts.

Add the fourth ingredient — `firepowerScale()` gave each escort 3–5 HP because
the player's gun was good — and the required clearance rate exceeds what a
single column of bolts can deliver. The boss takes zero damage indefinitely.
That is not a tuning problem. It is a structural one.

---

## 2. The three rules this cycle is built on

1. **Difficulty comes from time, waves and mission act — never from the
   player's gun.** This is the locked PR2 rule and it is the spine of
   everything else.
2. **A shield is a clock, not a wall.** Every screen has a bounded life, a
   bounded relaunch, and hands the player a punish window when it ends.
3. **Every combat event tells you it happened.** Today the most common event in
   the game — a hit that does not kill — has no feedback at all.

---

## 3. Player weapons

### The ladder

Nine rungs under the owner's nine held icon names, in four families. Guns are
never an upgrade card; the rung is derived from XP rank, as today.

| # | rung | family | shots (offsetX) | rate | dmg | on-target dps | rank |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| 1 | BB SHOT | Starter | `[0]` | 0.14 | 1 | 7.1 | start |
| 2 | TWIN BEAM | Starter | `[-6, +6]` | 0.13 | 1 | 15.4 | 3 |
| 3 | TRI-BEAM | Starter | `[-7, 0, +7]` | 0.16 | 1 | 18.8 | 5 |
| 4 | QUAD BEAM | Starter | `[-16, -5, +5, +16]` | 0.10 | 1 | 20 light / 40 heavy | 7 |
| 5 | PULSE WAVE | Pulse | `[0]` wide, pierce 1 | 0.10 | 4 | 40 | 9 |
| 6 | ROCKET BARRAGE | Rocket | `[-9, 0, +9]` + splash | 0.15 | 3+3 | 40 light / 60 boss | 10 |
| 7 | PLASMA CANNON | Plasma | `[0]`, clears shots | 0.12 | 6 | 50 | 12 |
| 8 | LEDGER STORM | Elite | `[-12,-6,0,6,12]` pierce 1 | 0.12 | 2 | 50 / 83 boss | 15 |
| 9 | HYPER PULSE | Elite | `[0]` 36px, pierce 3 | 0.10 | 6 | 60 | 19 |

`CLARITY LANCE` is retired. Today it is a **downgrade**: at zero barrels it does
11.5 dps against QUAD's 33.3, and it is granted automatically at rank 12 with no
way to decline. **[graft, systems]** The dps column above is strictly monotone,
and a validator asserts each rung's zero-barrel dps is at least the previous
rung's. That assertion is the thing that prevents another Lance.

Level 1 pays about 13,770 XP, so it hands out everything through PLASMA CANNON
at 93%. The two elites are arcade and Level-2 goals.

### What makes a family different

Not bigger numbers — different answers.

- **Starter** is parallel bb lanes. Coverage.
- **Pulse** is a wide flat wave (24×9 hitbox, three times a bb bolt) with
  pierce. It covers a light drone even after its 40px dodge half-completes, and
  a column of two dies to one wave.
- **Rocket** splashes 3 damage in a 32px radius on drones and hazards, but
  deals direct damage only to bosses and warship systems. Armour shrugs off the
  blast, not the shell. This keeps boss dps bounded and readable.
- **Plasma** deletes any hostile shot its ball touches. A plasma lane is a
  moving hole in a fog wall.

### Barrels

The `#113` parity fix generalised: **an even-count gun buys the centre lane
first**, then pairs. Lane spacing is per family — 9px Starter and Rocket, 6px
Storm, 12px Plasma, 18px Pulse. `MAX_VOLLEY` rises from 7 to 11 (odd).

On `main` today: TWIN stalls at 6 lanes with its third barrel buying nothing,
QUAD stalls at 6 with its second *and* third buying nothing, and TWIN's ±9
leaves an 18px hole against 15–17px enemies. Under the new rule every barrel
buys at least one lane and every gun reaches the cap.

**[graft, boss director]** `WeaponShotDef.damageScale`, so barrel pairs on the
heavy families fire at 0.5×. Without it a three-barrel Rocket or Plasma is a
7× damage multiplier.

### Upgrade tracks

Four tracks today, six after this cycle, because `ALL MAX` is currently
reachable inside Level 1 and level-ups after that are pure score.

Existing: **BARREL PAIR** (cap 3), **SHIELD PLATING** (cap 6), **BOMB YIELD**
(cap 2.32), **PULSE FIELD** (cap 2.26). New: **SEEKER SALVO** (+1 missile per
launch, cap 3, offered only once seekers unlock) and **FINALITY** (fire interval
×0.94 per pick, cap 3). Finality is only safe *because* PR2 removes the HP
coupling — under today's code a rate track would inflate every enemy on screen.

---

## 4. Bosses

### The Fog Screen replaces the escort screen

The shield stops being a wall and becomes a meter the player can read:

- `moveDrones` is called during boss and warship fights, so escorts actually
  fly, hold station, fire, dodge and flee. This alone revives `ESCORT_PATIENCE`.
- **At most 3 escorts alive.** A launch refills to 3, it does not add 3.
- **`SCREEN_SECONDS 6.0`** on launch. Each escort killed cuts **2.0 s**.
- **`SCREEN_COOLDOWN 12 s`** before another screen may launch.
- Worst case with the player killing *nothing*: shielded 6 of every 18 seconds.
  **The boss is exposed at least 67% of the time by construction.**
- Escorts are per-boss, not always `regulator_drone`: Gary gets fog raiders,
  the Behemoth regulators, the Destroyer whale scouts, Final Clarity rug
  fighters.

**[graft, arcade] Shield OVERLOAD.** When the clock expires with escorts still
alive, the survivors become ordinary drones and the boss is forced into a 2-second
`recover` at 1.6× damage with a shield-break beat. Every screen ends in a
guaranteed punish window, so the clock is a promise rather than a timeout.

**[graft, mobile] One screen per phase** via `BossPhaseDef.screens`, with a
REINFORCE feint occupying the slot when the screen is spent, so the learned
rhythm of the script holds.

**[graft, boss director] The fatigue floor.** After 60 seconds in one phase,
armour drops to 1.0×, exposed rises to 2.0×, and screens are disabled. A
starter-gun player still finishes. It is a last-resort backstop, not a tuning
knob.

### Per-boss

Boss HP becomes a fixed authored number instead of `def.hp × firepowerScale()`,
which today swings Gary Fog between 142 and 792 depending on what gun you happen
to be holding when he spawns.

| boss | HP | fight target | notes |
| --- | ---: | --- | --- |
| Gary Fog | 520 | 22–30 s | intro trimmed 10.6 s → 8.8 s; phase 3 screens |
| Regulatory Behemoth | 150 | 24–34 s | phase 2 rescripted; screen no longer opens phase 3 |
| Clarity Destroyer | 360 | 28–38 s | **gets a script at all** — has none today |
| Final Clarity | 800 | 40–55 s | **gets a script at all**; arcade capstone |
| Regulatory Warship | 336 systems | 30–40 s | defenders unfrozen; systems ×4 |

Clarity Destroyer and Final Clarity currently have no `attacks` array, so they
fire timed volleys with no tell, no armour and no punish window — and they die
*faster* than the scripted Behemoth. The ladder's difficulty is inverted today.

Phase changes get a beat: 0.6 s exposed hold, two expanding rings, script reset,
shots cleared, escorts dismissed, and a banner — `PHASE 2 // THE FOG THICKENS`,
`PHASE 3 // NO COMMENT`. Today a phase change is a HUD label and an accent
colour, which is why Ryan never noticed the escalation.

### The Ryan detector

**[graft, boss director]** `scripts/validate-boss-tempo.mjs`: drive `Game2A`
headless through `deployTestMode()` with scripted players at BB×0, TRI×1 and
PLASMA×3, and **fail on any 10-second window with zero boss damage while the
player is firing**, or any kill time outside 30–95 s.

This is the check that would have caught the 87-second fight before Ryan did.
Every other guard in this section is a design intention; this one is a test.

---

## 5. Ground items

Six new, two reworked. Hazards today are one thing — a turret that drifts in
from a roadside and fires the same aimed shot as every other turret, because
`HazardDef` has no projectile or pattern field.

| item | role | behaviour | counterplay |
| --- | --- | --- | --- |
| **FOG GENERATOR** | area denial | raises the stage fog level; exhales fog banks that absorb 4 bolts | 5 HP; killing it bursts every bank at once |
| **WATCH TOWER** | force multiplier | inside its ping, drones lead their shots and fire 30% faster | 4 HP, fragile, always spawns 1.2 s before the formation it supports |
| **LEDGER NODE** | reward | three hits crack it open; drops CLARITY, +60 XP | none needed — the trade is exposure for the drop |
| **BEAR TRAP** | positional | 0.5 s tell, then snap-detonates at close range | shoot at range, or read the tell and leave |
| **CLARITY BEACON** | friendly | fly through it for 8 s of clarity; fog lifts, enemy dodge disabled | placed under a turret's firing window, so reaching it costs position |
| **ENERGY BARRIER** | blocking | two posts, a beam between, a 40px gap | line up with the gap, or shoot a post |
| **LASER TOWER** (rework) | tell-and-beam | 0.85 s tell along a locked line, then a 0.45 s beam | move off the line — standing still is what gets you |
| **MISSILE SILO** (rework) | tracking | fires a slow seeker that is itself a 1 HP target | shoot it down, or outturn it |

**[dropped, judges]** The bear trap's original 40px pull. Tugging the ship
fights the player's only input on a phone.

**[dropped, judges]** Fog banks hiding drones at alpha 0.25 and dimming the
backdrop to 0.45. That is a readability hazard at 20px on a phone in daylight.
Fog stays a *mechanic* — it absorbs bolts, it disables dodge when lifted — but
it is drawn as an outline and a vignette, and the backdrop never goes below
0.6. **The Watch Tower's ping ring halves to 130px**; at 260px it covered most
of a 393px screen.

**[graft, systems] FOG PROJECTOR**, a small ground item that shields the nearest
drone using the same rules as the boss screen. It rehearses the escort-screen
read at small scale, before the player ever meets Gary Fog.

**[graft, arcade] CLARITY UPLINK**, a chain-score object: a kill within 2.5 s of
entering its window starts a ×2 score streak for 8 s, extended 3 s per kill.
The one genuine shmup scoring hook in all five proposals, and it costs no HP.

---

## 6. Pickups

Five of the nine curated pickups get wired: **CLARITY** (the thematic keystone —
lifts the fog, disables enemy dodge, +35 special), **EXTRA LIFE**, **RAPID
FIRE**, **INVINCIBILITY**, **SPEED BOOST**. Shield cell, repair, upgrade crate
and bomb stay as they are.

**[graft, systems]** Field buffs are stripped by a **hull** hit but survive a
**shield-absorbed** hit. That makes shield segments the thing that protects your
streak, and gives the 7-second regen delay real tension.

**[graft, mobile]** EXTRA LIFE is a stored revive token (max 1, HUD heart
outline) rather than a max-HP bump, and crit is deterministic — every 4th bolt,
no RNG — because random extra damage is unreadable on a 1–2 HP target.

**[graft, systems] `registerHazardKill()`.** Hazard kills currently feed nothing:
not the kill count, not the pickup cadence, not the wave-clear bonus. 22 of the
96 authored groups in Level 1 are hazard-only and pay no XP at runtime.

**CRITICAL CHANCE is held**, not wired. Random damage on a 1–2 HP target cannot
be read.

---

## 7. Effects

Eleven effects, each tied to an event that has **no feedback today**.

The headline: **a non-lethal hit is the most frequent event in the game and it
is completely silent.** HP is decremented and nothing is drawn. With
firepower-scaled HP, every enemy above 1 HP absorbs shots invisibly.

- **Hit flash** — 0.08 s lighter-composite redraw on any non-killing hit.
- **[graft, arcade] Boss hit triad** — armoured hits give a grey clink, exposed
  hits a gold burst, blocked hits one throttled ring per 0.12 s. This makes the
  0.3×/1.6× armour script legible at 20px.
- **Boss phase beat** — see §4.
- **Boss death sequence** — 1.6 s of jitter, flicker and six spark bursts.
  Today the biggest fight in the game ends with a single 6px spark and the
  sprite vanishing in the same frame.
- **Fog Screen lift** — the ring shatters into 8 arc fragments.
- **Player hit: shield vs hull** — a blue hex ripple versus a red vignette.
  They are identical today, so PR1's shield readability work stops at the HUD.
- **Muzzle flashes** — and the silent guns get sounds. Hazard turrets, warship
  volleys, boss aimed volleys and sweep beams all fire silently today.
- **Rocket splash and plasma burn**, **pickup burst and buff timers**,
  **clarity lift**, **seeker trails and escort tethers**.

**[graft, mobile] Hard feel ceilings, adopted verbatim as acceptance criteria:**

| effect | ceiling |
| --- | --- |
| hitstop | ≤ 80 ms |
| screen shake | ≤ 6 px, ≤ 250 ms, translate only |
| vignette | ≤ 0.3 alpha, never on a shield hit |
| i-frame blink | 8 Hz |
| damage numbers | none |

**[graft, mobile] Muzzle pips** — one 5px family-coloured dot per lane for
40 ms, so you read your volley shape at the muzzle instead of squinting at 7px
bolts. And on screens under 400px the boss shield shows an escort-count digit
next to the health bar instead of the sentence `SHIELDED • CLEAR N ESCORTS`.

**[dropped, judges]** Floating damage numbers and score floats. Clutter over a
20px battlefield, and the thumb covers them.

### The effects budget goes *down*

A shielded boss under a 7-lane volley currently spawns roughly **58 rings and
800 debris particles per second**, with an unthrottled `deny` sound on every
blocked bolt. Rings cap at 24, debris at 320, blocked rings throttle to one per
0.12 s, and `deny` gets a 120 ms minimum gap. The worst case after this cycle is
quieter than the worst case today.

---

## 8. PR order

Locked gameplay PRs in **bold**. Asset PRs are separate by rule, and each one
lands *after* the gameplay PR that gives its files a consumer.

| PR | scope | after |
| --- | --- | --- |
| PR-A0 | asset housekeeping: delete the orphan turret, create `combat/`, add a manifest-vs-registry consumer validator | #114 |
| **PR2** | enemy doctrines + `firepowerScale` decoupling + fixed boss HP | PR-A0 |
| **PR2b** | Fog Screen: `moveDrones` during bosses, escort cap, screen clock, overload, phase beat, tempo validator | PR2 |
| **PR3** | size classes + Whale Scout mini-destroyer | PR2b |
| PR-A1 | six enemy sprites | PR3 |
| **PR4** | the nine-rung weapon ladder | PR2, #113 |
| PR-A2 | four projectiles + nine weapon icons | PR4 |
| PR5 | upgrade tracks + five pickups + `registerHazardKill` | PR4 |
| PR-A3 | five pickup sprites | PR5 |
| PR6 | ground items | PR2, PR5 |
| PR-A4 | five ground sprites | PR6 |
| PR7 | the effects pack | PR2b, PR4 |
| PR-A5 | shield-break sheet | PR7 |
| PR8 | Destroyer and Final Clarity scripts | PR2b, coordinates with #108 |

**[dropped, judges]** Six new mechanical enemies inside PR3. That slot is
"size classes + Whale Scout"; the new roster moves to a PR3b.

**PR2b is an insertion** into the locked order, between PR2 and PR3. It is the
fix for the fight Ryan reported, and it is small — bounded to `launchEscorts`,
`bossShielded`, `bossDamageScale`, `updateBoss` and the boss draw calls. Flagging
it explicitly rather than folding it into PR2 or PR3.

---

## 9. What has to be true before any of this ships

- **#113's centre-beam parity fix must merge or be subsumed by PR4.** Three of
  the eight rungs on the open #106 are even-count and would reintroduce the
  split-volley hole.
- **PR2 alone ships a mistuned window.** Fixed boss HP is tuned against the
  *new* ladder. Between PR2 and PR4 the retired Lance leaves a 60–75 s Gary
  Fog fight. Either ship a temporary Lance dps bump in PR2 or land PR4 close
  behind it. This is called out rather than discovered later.
- **Three validators hard-code the things PR2 removes.** `validate-difficulty`
  requires `arenaEnemyCap()` to reference `firepowerScale()` and boss HP to be
  `Math.round(def.hp * this.firepowerScale())` by literal regex. Those edits
  belong in the same PR or the gate fails.
- **`npm test` is not run by CI.** `.github/workflows/build.yml` runs only
  `npm ci` and `npm run build`. Every validator in this plan is currently
  enforced by local discipline alone. Worth fixing early.

