# Phase P — Original-Build Backgrounds

## Scope

- Integrates four original-build vertical backgrounds for Ledger City, Data Canyon, Regulatory Outpost, and boss encounters.
- Adds a cover-scaled, vertically scrolling canvas backdrop with a readability shade.
- Preserves the procedural gradient, grid, and building renderer as the missing-asset fallback.
- Changes no enemy, boss, weapon, collision, progression, or persistence values.

## Runtime Rules

- Stage records own their background manifest reference.
- Active boss encounters temporarily use the original boss-arena background.
- Backgrounds are optimized 720 × 1280 WebP files; the original PNG masters remain outside the deploy repository.

## Verification

- Confirm all four manifest paths resolve.
- Verify seamless vertical coverage on narrow phone and wide desktop canvases.
- Confirm player, hostile shots, pickups, and HUD remain readable over every stage.
- Run the clean Vercel build and test the stage changes at waves 4 and 7 plus a boss gate.