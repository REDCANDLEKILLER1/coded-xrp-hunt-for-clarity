# Civic finishing pass — September 20, 2026

Local continuation of bcfc398. No merge or publication in this pass.

## Delivered
- Medic and armorer stand 1.4m behind their respective counters. Placement and solid body collision use civic-layout.json, shared by runtime navigation and vendor placement.
- Vendor ellipsoids now use ico-sphere geometry. Two independent Blender 4.3.2 bakes have identical SHA-256 A11B7CE6FBD20C589584926B974F610753D78B71C04DA326099CD4E459B934DB. 192,004 bytes, 1,752 triangles, 3 surfaces, 36 bones. Earlier masters preserved.
- Four service signs and two posters are actual Civic scene surfaces, loaded from the manifest only with Civic. Six planes add 12 triangles and six draw surfaces, separately from the unchanged deck model. Late texture completions dispose themselves after scene abort; attached resources use scene disposal.
- Artwork totals 271,504 encoded bytes. The validator caps it at 300KB and checks artwork + four models + renderer allowance against the existing resident encoded ceiling. This is NOT GPU memory measurement. Texture dimensions are 512x341 signs and 384x576 posters (approximately 6.1MB RGBA with mipmaps across six images).

## Verification
68-validator suite passed, separate TypeScript check and production build passed. Browser play: traversed from lift into medical shop, confirmed sign readability and vendor behind counter. 390x844 browser viewport shows Return, item art, Buy and Sell without clipping. Purchase changed credits 500 to 465. Existing driven shop/save tests cover sell, rest, reload and one-time upgrades.

## Boundaries
This finishes the current medical/armory Civic pass, not the whole warship city. Bank remains informational; casino, brig, hangar and residential expansion remain sealed. Owner is designing casino slots. Vendors remain stylized placeholders. No real-phone GPU/thermal claim. Existing build chunk-size warning remains.

## Recovery
Code archive restored under C:/Users/Michael/CODED_3D_MASTER/safety/civic-finish-20260920/restore; vendor binary hash checked against original. Versioned vendor masters are outside the repository. Generated originals remain local under artifacts/civic-art-batch-20260920 and original image-generation storage; do not stage that directory.

## Art provenance
Original built-in image_gen outputs, converted to WebP using Sharp; no external artwork. Full prompts below.

### medical-exchange-sign-v1

Wide 3:2 front-facing full bleed wall sign texture for CODED enemy battleship game. Exact large text MEDICAL EXCHANGE, smaller TRIAGE • SUPPLIES. Offwhite medical plus in teal recessed enamel at left, charcoal brushed steel, beautifully detailed worn edges, engraved panel seams, tiny bolts, restrained teal illuminated lettering. Premium realistic sci-fi game environmental art, readable at distance. Flat orthographic rectangle, no surroundings, no perspective mockup, no watermark. Typography fills panel, controlled light, dark but readable.

### armory-sign-v1

Wide 3:2 front-facing full bleed wall sign texture for CODED enemy battleship game. Exact large text ARMORY, smaller CAPACITOR WORKSHOP. Stylized paired power-cell emblem left. Charcoal brushed steel, copper amber recessed enamel lettering, beautifully detailed wear and tooling, tiny bolts and panel seams. Premium realistic sci-fi game environmental art, readable at distance. Flat orthographic rectangle, no surroundings, no perspective mockup, no watermark. Consistent authoritarian naval industrial style, dark but readable.

### warship-bank-sign-v1

Wide 3:2 front-facing full bleed wall sign texture for CODED enemy battleship game. Exact large text WARSHIP BANK, smaller CREW ACCOUNTS. Geometric vault emblem left. Charcoal brushed steel and restrained antique gold inset lettering, security pattern etched into edges, beautifully detailed wear, tiny bolts and panel seams. Premium realistic sci-fi game environmental art, readable at distance. Flat orthographic rectangle, no surroundings, no perspective mockup, no watermark. Dark naval industrial style.

### crew-quarters-sign-v1

Wide 3:2 front-facing full bleed wall sign texture for CODED enemy battleship game. Exact large text CREW QUARTERS, smaller REST • RECOVER. Bunk berth emblem left, offwhite letters with restrained blue illuminated edge, charcoal brushed steel, beautifully detailed worn edges and panel seams, tiny bolts. Premium realistic sci-fi game environmental art, readable at distance. Flat orthographic rectangle, no surroundings, no perspective mockup, no watermark. Dark naval industrial style.

### water-is-life-poster-v1

Portrait 2:3 full bleed original propaganda poster texture inside fictional enemy battleship city in CODED. Exact typography WATER IS LIFE at top and REPORT EVERY LEAK at bottom. Beautiful retrofuturist screenprinted illustration of a monumental water purification tower and descending pipes feeding a tiny city inside a spaceship, one luminous turquoise droplet foreground. Charcoal, muted teal, parchment white and small authoritarian red accents. Distressed paper edges, tactile grain, rich deliberate graphic composition. Serious believable lived-in naval civilization, no real world political symbols, no watermark, flat poster no surrounding wall.

### ship-remembers-poster-v1

Portrait 2:3 full bleed original propaganda poster texture for fictional enemy battleship city in CODED. Exact large title THE SHIP REMEMBERS and footer EVERY SHIFT. EVERY SACRIFICE. Dramatic beautiful retrofuturist printed illustration of a vast dreadnought silhouette above anonymous worker silhouettes and enormous industrial ribs, glowing scarlet sun-like reactor disc behind ship. Charcoal black, muted crimson, ivory highlights, weathered archival paper texture. Sophisticated authoritarian naval recruitment aesthetic, ominous story-rich art. No real world political symbols, no watermark, flat poster no wall or frame.


## Service and portrait follow-through
Two original portraits are now loaded on demand by the medical and armory panels. Bank provides a read-only shared-account summary; it does not introduce deposits, interest or transfers. Quarters offers explicit free rest/save and reports persistence failure correctly. Removed the former unsupported claim that resting restored saved vitals: this service stores a checkpoint, not a persistent health value. Keyboard focus enters the panel on opening. The portrait plus item artwork is browser-verified at 390x844; the panel scrolls as needed. Targeted service tests prove bank is read-only, rest is free, and failure does not report success.
