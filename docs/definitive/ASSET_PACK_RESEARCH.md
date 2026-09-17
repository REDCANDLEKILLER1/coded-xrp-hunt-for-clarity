# Warship asset-pack research

Reviewed 2026-09-16 for the captured-Warship city, humanoid enemies, and replacement character motion.

## Selected sources

### Quaternius Modular Sci-Fi MegaKit

- Source: https://quaternius.com/packs/modularscifimegakit.html
- Licence shown by publisher: CC0
- Formats: glTF, FBX, OBJ, Blend
- Scope: 277 grid-based walls, floors, doors, columns, props, and alien modules
- Planned use: separate ship districts, pressure corridors, utility decks, market structure, and habitation shells

### Quaternius Sci-Fi Essentials Kit

- Source: https://quaternius.com/packs/scifiessentialskit.html
- Licence shown by publisher: CC0
- Formats: glTF, FBX, OBJ, Blend
- Scope: 65 futuristic props, weapons, animated screens, and animated robot enemies
- Planned use: equipment, terminals, weapons, and enemy prototypes after visual and performance review

### Quaternius Universal Animation Library 2

- Source: https://quaternius.com/packs/universalanimationlibrary2.html
- Licence shown by publisher: CC0
- Formats: GLB, FBX, Blend
- Scope: 130+ humanoid clips including locomotion, armed combat, and separated three- and four-hit melee combos
- Planned use: retarget candidate for XRP Man, Mr Zamn, and humanoid enemies; every clip must be inspected on the actual game rig before it replaces a shipped action

### Kenney Space Station Kit

- Source: https://kenney.nl/assets/space-station-kit
- Licence shown by publisher: CC0
- Scope: 90 modular sci-fi interior pieces
- Status: already vendored with its licence receipt and used by the boarding-deck build pipeline

## Integration rules

1. Keep each source in its own vendor folder with the publisher page, licence text, retrieval date, and archive hash.
2. Import only the modules used by a district; do not ship whole source archives to players.
3. Retarget animation in Blender, remove root drift where gameplay owns movement, and verify feet, weapon grip, hit timing, and silhouette in the actual camera.
4. Batch repeated static architecture by material, preserve named collision/service anchors, and keep each district independently loadable.
5. Run phone memory and draw-call checks before enrolling another district.

Adobe Mixamo remains a valid fallback for biped animation. Adobe states that Mixamo characters and animations may be used royalty-free in video games, but Mixamo material must keep its own Adobe provenance and must never be labelled CC0.
