# Civic market pass — September 20, 2026

Continues draft PR #131, astra/chapter-one-interior. Web app is the active target; Android/iOS packaging is on hold. Main and all merges remain held. Automated watch remains stopped.

## Delivered in this pass

- Expanded Civic to a 64 x 52 metre pressure deck with four separate service rooms: medical exchange, capacitor workshop, bank and crew quarters. Broad central promenade, physical doorways, inset shop floors, floor signage, counters, stock displays and bunks.
- Shared civic-layout.json drives service coordinates and model/runtime collision partitions. All nine existing service/gate anchors are retained. Future casino, brig, residential and hangar gates are still sealed; bank remains informational.
- Existing med-pack buy/sell and capacitor transactions now work after resting without resetting the quarters spawn. Prices and upgrade strength unchanged.
- Shopping stops movement. Companion follows recorded player route around partitions. Walk/run/idle selection and crossfades use existing model clips. Claude 7890806 provided crossfade approach and production-update harness pattern; its direct-distance follow logic was not adopted because the new rooms need obstacle-aware following.
- Hero uses walk at low analog speed and idle against blocked movement. Camera starts closer and retains 8–24 zoom range.

## Verification and limits

Full 68-validator suite and production TypeScript/build run. Added graph traversal for every service, GLB-anchor coordinate agreement, production movement drive through medical doorway for hero and companion, actual clip availability, slow-input and wall-idle checks, and buy/sell/upgrade after rest with reload persistence.

Browser: walked lift to medical around planter and through entrance, opened shop, bought and sold a pack: 500 -> 465 -> 483 credits. Screenshot evidence private under CODED_3D_MASTER/districts/civic-market-v02. This is functional stylized architecture, not final realistic interiors or a populated city. Real phone memory/frame rate remain unmeasured. No new shop inventory or NPC population claimed.

Model: 497,876 bytes, 8,244 triangles, 11 surfaces. Existing caps unchanged (900,000 bytes / 12,000 triangles / 16 surfaces). Source script + shared JSON fully tracked; private master under CODED_3D_MASTER/districts/civic-market-v03.

Recovery: pre-edit HEAD 9ab7a9b archived outside repository at CODED_3D_MASTER/safety/civic-market-20260920/before.zip and extracted for restore check; restored Civic GLB hash matched. Original masters and unrelated untracked files preserved.

Next: Claude audit, richer licensed shop dressing and distinct vendor characters; improve density and atmosphere without enlarging the district merely for scale. Keep shared economy and save behavior guarded.
