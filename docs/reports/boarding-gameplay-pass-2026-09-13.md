# Boarding gameplay pass - 2026-09-13

## Outcome

Chapter One's Warship boarding section now uses every authored room for combat, preserves room clears and retries, recruits Mr Zamn as a following combat companion, and requires positioning around cover and the bridge exit field. The shipped XRP Man runtime also has anatomically backward knee flexion in Walk, Run, Dodge and KnockdownRecover instead of the forward-kicking gait.

The deck remains eight hull-valid rooms. Room widths were enlarged where the capital-ship hull permits, total walkable floor area increased about 9%, and enemy placements rose from 7 to 32. The 3D deck export is smaller than the previous runtime despite the denser layout because continuous pressure-deck plates replace the former small repeated floor tiles.

## Browser playtest

Chrome/WebGL was tested at 390x844 through hangar, security, rescue, engineering, command, Core and captured bridge.

- Hangar and security established the intended difficulty; one death produced the saved-room retry panel and restored 100 vitals.
- Mr Zamn followed after the rescue conversation, changed rooms with the player and fired at visible targets. During the Core clear the counters recorded 229 hero shots and 73 companion shots.
- Cover blocked both hostile and companion bolts and required lateral routes around machinery.
- The Core required both relays and multiple timed exposure windows. A careless first approach died; the second, cover-led approach cleared it.
- The bridge exit field stopped the unshielded player at z=35.998. Ledger Shield permitted crossing to z=37.245.
- Warship capture completed with 100 vitals and 100 shield. The browser showed only the existing favicon request error; no page or runtime exception occurred.
- The final departure click was not counted as a manual pass because the post-hot-reload navigator stalled against bridge cover. Its persistent transaction and reload behavior pass the boarding quest validator.

## Visual assets

Two original 16:9 background illustrations were generated and optimized to WebP:

| Runtime asset | Source generation | Prompt summary |
|---|---|---|
| public/assets/interior/regulatory_core_chamber.webp | C:\Users\Michael\.codex\generated_images\01a07f9b-fe5f-70b0-b9c8-7f89b4f1f510\exec-b1def2a1-a24e-4d79-9af0-bcd1dd33f65e.png | Massive armored reactor hall, central red Core and two green relays, steel-blue industrial lighting, no text, logo or watermark |
| public/assets/interior/regulatory_captured_bridge.webp | C:\Users\Michael\.codex\generated_images\01a07f9b-fe5f-70b0-b9c8-7f89b4f1f510\exec-52c7a00e-a19e-406f-87ae-8427140fb2dd.png | Captured capital-ship bridge and fleet view, green friendly systems with red hostile remnants, no text, logo or watermark |

Existing interior art now appears as room-scale wall panels. Procedural floor lanes and XRP insignia add orientation and faction cues without baked text.

## Runtime and private masters

- public/assets/models/xrpman.glb: 3,066,484 bytes, SHA-256 daf20943dcf656630e82aec32ea26fb6f71122b9ead4d2aef9a775703e4fc030.
- Private XRP Man motion master: C:\Users\Michael\CODED_3D_MASTER\characters\xrpman\blender\xrpman_master_v08.blend.
- Private motion export: C:\Users\Michael\CODED_3D_MASTER\characters\xrpman\exports\xrpman_motion_v08.glb.
- public/assets/models/boarding_deck.glb: 3,144,760 bytes, 37,088 triangles, SHA-256 8cd0c65ec7d768776cf8a196938dc26b6426458815ebfb443db121f6629e8b42.
- Private deck master/export: C:\Users\Michael\CODED_3D_MASTER\regulatory_warship\interior_v05.

All prior private versions remain preserved. No private master or raw review render is published.
