# Phase 2B Pre-Work Audit

Audit of `main` performed on branch `claude/dreamy-lovelace-41mioi`.
Scope: confirm the engine is stable and deployable before Phase 2B asset replacement.

## Audit checklist results

| # | Check | Result |
|---|-------|--------|
| 1 | `npm install` | ✅ Works (11 packages, no install errors). |
| 2 | `npm run build` (`tsc && vite build`) | ✅ Clean build, 8 modules, `dist/` ~15 kB JS gzip 5 kB. |
| 3 | Game boots locally | ✅ `main.ts` mounts `#game` canvas and starts `Game2A`. |
| 4 | Touch/start flow | ✅ Sane. Tap/Enter starts from title & restarts from results; drag-to-fly with keyboard fallback; on-screen PAUSE / PULSE / D zones plus keyboard (P, Space, D). Control zones are excluded from the fly-to-pointer move so taps on buttons don't yank the ship. |
| 5 | Broken imports | ✅ None. All imports resolve and type-check. |
| 6 | Accidental test/noop/marker files | ✅ None on disk. (History note below.) |
| 7 | Asset manifest resolves / fails gracefully | ✅ All 5 manifest entries exist; loader degrades to procedural vector art on any miss. |

## What works

- **Build & deploy path is green.** `vercel.json` uses `npm run build` → `dist`, matching the GitHub Actions `Build Check`. No env vars, secrets, or external services required.
- **Runtime is self-contained.** `Game2A` is the live engine: title → play → results loop, score/wave, special pulse, HUD, pause, and a diagnostics panel.
- **Asset loader is robust.** `AssetLoader` fetches `/assets/manifest.json`, preloads every entry, and records per-asset diagnostics (`loaded` / `missing` / `error`). On a missing image it falls back to procedural Canvas art, so the game never hard-fails on a bad asset. Diagnostics auto-open when anything is missing and can be toggled with `D`.
- **Manifest paths all resolve.** `ships/player`, `enemies/regulator_drone`, `projectiles/bb_shot`, `vfx/burst_ring`, `special/clarity_pulse` each map to an existing `.svg` in `public/assets/`.
- **Repo hygiene is in place.** `.gitignore` already blocks zips, archives, raw art (`*.psd/*.clip/*.kra/*.aseprite`), and `large-raw-assets/` — good guardrails for Phase 2B.

## What is broken / needs attention

Nothing is build- or runtime-breaking. The issues are cleanliness and latent gaps:

1. **Orphaned Phase-1 code island.** `src/game/core/Game.ts` and the entire `scenes/`, `entities/`, `systems/`, and `data/` trees are imported by **nothing** reachable from `main.ts` (which uses `Game2A` directly). They type-check and are tree-shaken out of the bundle, so they're dead code — but they're a confusion/maintenance risk and duplicate the live engine's logic.
2. **History noise on `main`.** Two commits — `d823024` "NOOP SHOULD NOT DO THIS" (adds `docs/phase-2b-clean-noop.txt`) and `787deb2` "Delete file" (removes it) — net to zero on disk but pollute history. Nothing to clean on disk; can't be removed without rewriting `main` history (out of scope, no force-push to main).
3. **Spritesheet type not yet rendered.** The manifest and `AssetLoader` carry `type: "spritesheet"` + `sheet` metadata (e.g. `vfx/burst_ring`), but `Game2A` only ever calls `getImage()` and `drawImage()` whole — there is no frame slicing. Animated sheets will draw as a single static frame. This is the main engine gap for Phase 2B/animation work.
4. **Dev-only npm advisory.** `npm audit` flags esbuild/vite (`GHSA-67mh-4wv8-2f99`) — affects the dev server only, not production builds. The fix is a breaking `vite@8` bump; not worth taking mid-phase.

## What should be fixed first

1. **Remove or quarantine the orphaned Phase-1 island** (`Game.ts`, `scenes/`, `entities/`, `systems/`, `data/`) so Phase 2B work happens against one unambiguous engine. Cleanest done as its own small PR.
2. **Add sprite-sheet rendering** in the loader/renderer so `type: "spritesheet"` entries actually animate — this unblocks real animated assets in Phase 2B.
3. Defer the vite/esbuild upgrade and any `main` history rewrite — neither blocks Phase 2B.

## Is Phase 2B asset replacement safe to continue?

**Yes.** The build is green, the manifest contract is clean, and the loader already degrades gracefully on missing/broken assets — so GPT can swap manifest entries and drop optimized PNG/WebP/SVG files without risking a broken deploy. Two caveats:
- Animated **sprite sheets won't animate** until renderer support lands (gap #3) — static/single-frame assets are fully safe today.
- Keep honoring `.gitignore`: optimized game-ready assets only; no zips, archives, or raw art dumps.
