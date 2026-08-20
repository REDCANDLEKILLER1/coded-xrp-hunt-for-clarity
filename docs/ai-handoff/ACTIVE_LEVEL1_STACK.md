# CODED Level 1 Active Stack

**Updated:** 2026-08-19 / 2026-08-20 UTC

This is the compact resume note for a fresh chat. Read `CURRENT_STATE.md` and `LEVEL1_CANON_LOCKS.md`, then verify actual PR heads before writing code.

## Canon that must not drift

- Planet 1 is **Earth**. Earth is under attack; the mission has human/civilian stakes.
- Protect the validated responsive fighter movement/fire feel.
- Difficulty grows through new decisions and threat combinations, not screen spam.
- Gary Fog is the first Guardian.
- Gary rewards permanent fighter tech **Fog Breaker Pulse**.
- Level 1 final exterior ship is the **Regulatory Warship**; disable it, do not destroy it.
- No shuttle. The player's personal fighter flies directly into an opened hangar/breach.
- XRPMan exits the fighter and fights through the interior.
- Defeating the interior boss/core captures the Regulatory Warship intact.
- Captured Regulatory Warship becomes a separate persistent interplanetary capital ship for the later 3D-space layer.
- Three progression tracks: combat fighter / XRPMan / capital ship.
- No NFT/wallet/payment/blockchain work in Level 1.
- No merge without XRPMan approval.

## Active PR stack

### PR #45 — L1-A Mission Director Foundation
- `gpt/level1-a-mission-director` -> `main`
- Head `af1c919c8c8bb08255c8340c6c85d88123465600`
- Draft/open; exact-head GitHub Build + Vercel previously green.

### PR #47 — L1-B Local Mission Checkpoints
- `gpt/level1-b-checkpoints` -> L1-A
- Head `c1b140a1012e7a28c20d417ffdcd6a243d75110e`
- v3 local save migration, coarse snapshots, resume/restart.
- Exact-head Vercel previously green.

### PR #48 — L1-C Authored Earth Opening
- `gpt/level1-c-space-encounters` -> L1-B
- Head `efd863a82b6507037ea8bb0e80f103b812c9e3d2`
- Authored Orbital Approach, Fog Belt, Ledger City, Defense Grid; Test Mode preserved.
- Exact-head Vercel previously green.

### PR #49 — L1-D1 Immediate Threat Asset Bank
- `gpt/level1-d1-assets` -> L1-C
- Head `8e3bb3845f28e60c345f45dbf2dbd59b2949d22f`
- Fast Scout 95x128 WebP, 9,932 bytes.
- Armored Space Mine 128x109 WebP, 13,618 bytes.
- Manifest entries only + assets; no gameplay logic.
- Verify latest exact-head Vercel state before merge consideration.

### PR #50 — L1-D2 Progressive Mixed Earth Threats
- `gpt/level1-d2-defense-grid` -> L1-D1
- Head `d98e186c5de0d95085108ca8a355a8d2306f5c20`
- Teaches Scout, Basic Turret, Mine, Cannon Turret before mixed pressure.
- Reuses existing hazard engine; fighter feel unchanged.
- Intentional stop at `gary_fog`.
- Verify latest exact-head Vercel state before merge consideration.

### PR #51 — L1-E Gary Fog Guardian + Fog Breaker + Cinematic Buildup
- `gpt/level1-e-gary-fog` -> L1-D2
- Head at PR creation: `4b4911df7ad1f8af61cdd4c784bebc4073803dc8`
- Draft/open. Do not merge without XRPMan approval.
- Exact-head Vercel TypeScript/Vite build: **SUCCESS** before PR creation.
- `npm test` is not independently claimed as executed in this environment.
- Scope:
  - Gary starts deterministically at the authored `gary_fog` act.
  - Active threats/projectiles are cleared before the Guardian transition.
  - Permanent `shipTech` persistence added defensively without breaking legacy progress.
  - Gary reward is idempotent; checkpoint/reload cannot duplicate Fog Breaker.
  - Fog Breaker clears hostile shots and immediately clears the post-Gary fog lock.
  - Level 1 opening is music-led: empty battlefield first; selected fighter rises from below; enemies begin only after the entrance beat.
  - Gary is music-led: boss arena/warning begins first, **6 seconds of boss-music lead**, then **3.6 seconds creeping into frame**, then **1 second hold**, then combat arms.
  - Boss HP bar remains hidden until combat starts.
  - Existing fighter movement, pointer-follow, fire cadence, and collision constants preserved.
  - Arcade Test Run remains separate.
- New validation script: `scripts/validate-level1-e.mjs`; package `npm test` now chains existing validation + L1-E validation.
- Explicitly not in #51: Regulatory Warship, AudioDirector/binary music import, SFX, on-foot gameplay.

## Music / audio canon

### Level 1 track
User supplied **Neon Horizon Defense** by redcandlekiller.
- Source: `Neon Horizon Defense.mp3`
- Duration: **157.008 sec / 2:37.008**
- Source size: 3,652,031 bytes
- Approx integrated loudness: -12.3 LUFS
- Approx true peak: -1.4 dBFS
- Local optimized runtime candidate exists outside repo: `level1_neon_horizon_defense_runtime.mp3`, 2,512,556 bytes.
- Treat Neon Horizon Defense as canonical Level 1 music; do not replace with stock music.

### First boss track
User says a separate first-boss song was added to sources. As of the latest check, the only two MP3s visible in `/mnt/data` are `Neon Horizon Defense.mp3` and `Neon Horizon Defense(1).mp3`, and they are byte-for-byte duplicates. File Library search also did not surface a distinct boss-audio file yet. **Do not mislabel the duplicate as the boss song.** Recheck sources later and wire the distinct boss track when it becomes visible.

### Audio behavior already prepared in gameplay
`Game2A` emits `coded:music-cue` browser events for:
- `level1`
- `boss_gary_fog`
- `silence`

A later small AudioDirector/audio-assets PR should listen for these cues and perform actual playback/crossfades. Ship selection is a user gesture, making it the correct place to begin browser audio.

## Exact resume point

1. Recheck PR #51 exact-head status after any branch movement.
2. Do not claim `npm test` passed unless actually executed in an environment with dependencies.
3. Recheck sources for the distinct first-boss music file. Do not substitute the duplicate Level 1 track.
4. Next gameplay phase after L1-E is **L1-F — Final Assault + Regulatory Warship**.
5. Before/alongside L1-F, bank only the Regulatory Warship assets needed for the exterior encounter; do not mix on-foot assets yet.
6. Regulatory Warship fight is subsystem-based: port battery, starboard battery, shield relay, engine/propulsion nodes, command/hangar defense. Fog Breaker should expose the shield/relay vulnerability.
7. Warship ends in **disabled** state with a hangar/breach entry; it is not exploded.
8. Direct fighter boarding and on-foot mode remain separate later phases.
9. Audio/SFX remain just-in-time and must not block gameplay architecture.

After every new stacked PR, update this note.
