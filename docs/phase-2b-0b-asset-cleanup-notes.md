# Phase 2B-0b — Batch 0 Transparent Asset Cleanup

Cleanup pass on the existing Batch 0 runtime sprites so they render with true
transparent backgrounds and no visible square/dark-canvas artifacts in-game.
**No gameplay code, no new systems, no manifest key changes, same file paths.**

## Cleaned (4)

| Slot | File | Action |
|---|---|---|
| `ships.player` | `ships/player.webp` | removed baked caption strip + trimmed canvas; alpha verified |
| `enemies.regulator_drone` | `enemies/regulator_drone.webp` | removed stray edge/canvas; alpha verified |
| `projectiles.bb_shot` | `projectiles/bb_shot.webp` | removed baked dark bottom strip; trimmed to the bolt |
| `special.clarity_pulse` | `special/clarity_pulse.webp` | **removed baked dark-navy square background**; XRP ring + glow preserved |

Method: edge flood-fill background removal (kills dark/navy square + baked strips),
drop isolated caption/junk components, crop to the real sprite + small transparent pad,
re-export WebP with alpha (`alphaQuality 100`). Each was QA-inspected on black and on a
checker background — no square box, no hard rectangle edge; ship/enemy silhouettes and
glow preserved. All files remain tiny (≤ ~4 KB).

## Left unchanged (1)

- `vfx.burst_ring` — **not modified.** Inspection showed its source crop is actually a
  mislabeled **"REPAIR" caption** with only faint explosion glow, so it cannot be cleaned
  into a proper burst without redesign (out of scope here). It already has a transparent
  background (no square artifact). Recommend a dedicated small asset PR to replace it with a
  real green/blue ring burst, as anticipated in the task.

## Notes

- Manifest keys and `src` paths are unchanged, so `public/assets/manifest.json` is not edited.
- No raw/source files or archives committed; image processing was done with an ephemeral
  local tool outside the repo.
