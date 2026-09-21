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


## Dark market and vendor pass

Owner direction: dark enemy-battleship interiors, and greater use of generated imagery. Civic now uses charcoal metal, red perimeter strips, restrained teal medical lighting and amber armory accents. Stock shelves, labeled cases, original weapon silhouettes and terminals dress existing collision surfaces.

Two original named shopkeepers, Sera Vale (field medic) and Ivo Rook (armorer), share one 201,704-byte civilian mesh but own skeletons/material variants. Derived from Claude f3baab9 skeletal proof with original rounded facial forms, work glasses, apron and belt. Corrected Blender transform application to keep limb centres local before rotation. No external character references or third-party textures. Art remains stylized, not realistic human likenesses. Counters use existing med-pack and capacitor economy; no new inventory balance invented.

Deck: 702,856 bytes / 11,656 triangles / 11 surfaces. Vendor: 2,016 triangles / 3 primitives per instance / 36 bones. Limits unchanged. NPC residency included in district accounting and Claude 8adb885 route-derived payload guard integrated, with positive byte-count validation and an actual duplicated-request fixture replacing a tautological uniqueness assertion. These are encoded payload limits, not GPU memory measurements.

Generated item art is consumed by CivicShops: items/med_pack_v1.webp (49,342 bytes), items/melee_capacitor_v1.webp (56,360 bytes), both 512px with alpha. Built-in image generation used; only size/encoding optimized with Sharp. Original outputs remain private outside the repository. Individual 80 KB shop-image guard added. Generated art currently appears in shop cards; the physical counter cases remain authored geometry.

Med-kit prompt: Use case: stylized-concept. Asset type: finished inventory item artwork for CODED, a dark science-fiction action RPG aboard a captured enemy battleship. Create ONE detailed medical field kit, isolated and centered in a square composition with genuine transparent background. Three-quarter view from slightly above, entire object visible with generous clean margins. Compact rugged graphite metal hard case with beveled armored corners, two physical latches, dark fabric handle, inset off-white medical plus symbol and restrained teal status light. Worn brushed gunmetal, fine scratches, rubber seals, convincing layered manufactured surfaces. Premium realistic game-item render, crisp readable silhouette at small shop-card size. Dark military atmosphere but enough soft neutral rim light to read edges. No red cross, no lettering, no words, no watermark, no extra loose objects, no scenery, no surrounding UI. Do not make a flat vector icon or a generic glowing cube.

Capacitor prompt: Use case: stylized-concept. Asset type: premium inventory artwork for CODED dark science-fiction RPG on a captured enemy battleship. ONE compact melee capacitor upgrade module isolated on genuinely transparent background, square composition, generous margins, entire object visible. Three-quarter product view from slightly above. A believable hand-sized machined gunmetal cartridge designed to mount inside an armored gauntlet, with two recessed amber energy cells, copper contacts, heat-sink fins, locking pins and worn brushed-steel edges. restrained amber glow within protected cells, no magical lightning. Realistic physically manufactured object, refined high-detail game-item render, crisp small-scale silhouette, neutral studio rim lighting. Match a dark military medical-case inventory aesthetic. No lettering, no text, no logos, no watermark, no hands, no weapons, no extra objects, no surrounding UI, no scene. Do not produce a flat vector icon.

Shop UI now supplies vendor dialogue, item effects, prices, feedback and disabled states; real button handlers are exercised by the validator. Actual vendor GLBs are loaded in tests to check instance skeleton independence, shared geometry, drawable materials, animated standing bounds and resource disposal. Preview initializer now preserves an existing Civic balance/inventory/bed instead of minting credits and resetting spawn on every reload. Real campaign gate remains unchanged.

Browser final save loop: medical buy (500 -> 465, one pack), walk to quarters, rest, reload same isolated run. Observed spawn [20,0,8], credits 465, med packs 1. Shop scrolling now bypasses camera-wheel handling and the return button is at the top. Full 68 validators and production build pass after these changes. Runtime UI images have actual consumers and pass the image container validator.
