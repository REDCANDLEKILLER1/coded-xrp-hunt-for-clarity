# CODED: XRP — The Hunt for Clarity

Phase 1 playable browser-game foundation for a mobile-first sci-fi arcade shooter.

This is not the final game. It is the clean deployable shell: Vite, TypeScript, Canvas 2D, asset manifest loading, mobile controls, and a tiny playable vertical shooter prototype.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Deploy to Vercel

Import this GitHub repository into Vercel and use the defaults:

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
```

## Asset folders

Drop optimized web assets into `/public/assets/`:

```text
ships
enemies
bosses
weapons
projectiles
vfx
ui
base
campaign
hazards
objectives
special
```

Update `/public/assets/manifest.json` when new assets are added. The game must not crash when an asset is missing; fallback procedural drawing is used during Phase 1.

## Large archive warning

Do not commit huge raw zip archives, raw art folders, or the 782 MB backup bundle. Keep large raw art archives outside the repo, in releases later, or in external storage. GitHub should contain code, docs, manifests, and optimized web-ready assets only.

## Controls

- Desktop: WASD / arrow keys to move.
- Desktop: Space triggers the placeholder clarity pulse.
- Desktop: P pauses.
- Mobile: drag to move.

## Phase 1 checklist

- Vite app shell.
- Canvas game loop.
- Title screen.
- Play screen.
- Game-over restart.
- Auto-fire projectile.
- Enemy spawning.
- Collision and score.
- Health, wave, and special meter HUD.
- Missing asset fallback strategy.
