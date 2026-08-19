# Phase R — Original ground asset bank

Phase R restores the original-build ground and environment masters as optimized runtime WebP assets.

## Included

- Six ground-defense sprites: basic turret, cannon turret, cannon tower, laser tower, missile silo, and plasma turret.
- Seven environment sprites: mega tower, data spire, energy barrier, regulatory outpost, XRP billboard, defense turret, and asteroid.
- Every runtime file is referenced by `public/assets/manifest.json`; no raw PNG master or archive is committed.

## Processing

- Removed the opaque black presentation background while preserving emissive edges.
- Trimmed transparent margins.
- Capped ground defenses at 192 px and environment pieces at 224 px.
- Encoded as alpha WebP at browser-game quality.

Gameplay placement and collision remain isolated to the next phase.
