# Mars excavation and Margin Warden checkpoint

Extends the existing Earth-to-Mars earned campaign through Corn's north gate, a finite seizure patrol, the physical pressure gate, a three-cycle carrier boss, Mars restoration and a usable Liquidity Dash. Return to the relief site and reload retain progress. All 51 validators, a clean dependency install and the TypeScript/Vite production build pass.

## Gameplay and recovery

Four approach drones guard a physical control pedestal. Clearing them and opening the gate commits a safe arena checkpoint. The Margin Warden has two independently damageable supply towers. Both must fall within twelve seconds; this exposes its central control for 7.5 seconds. Real palm-origin 3D projectiles hit elevated mesh targets. A shot below the same XZ position cannot damage a tower. Mining laser lanes and drill impacts lock their positions before 1.25/1.5-second warnings. The active hazard budget is at most three. Shield, repair, movement and aiming remain available.

Victory grants the unique 320-salvage reward, Mars restoration, Fog Moon discovery and Liquidity Dash. The dash is immediately usable on both Mars maps, lasts .18 seconds, travels 3.6 metres and recharges over five seconds. Collision advances in .25m steps, so it cannot skip thin walls. The earned repair and fighter/capital progression tracks remain separate. Defeat retries at the saved gate, without repeating the relief quest. Failed victory saving holds a visible retry dialogue and prevents leaving before persistence succeeds.

Surface buttons now accept a secondary pointer down directly and preserve detail-zero keyboard activation. The actual browser test caught that a third-touch Dash tap otherwise produced no click while movement and fire were held. Native independent move/fire/dash, selective release, cancellation and rotation now pass. Full five-button HUD fits 390x844, 844x390, 360x740 and 1024x768. Gate posts have matching solid bounds; only the isolated gate frame fades when it obstructs the actual camera-to-hero line. Replaced lighting materials remain owned until scene disposal.

## Evidence

The original journey1 save previously earned Earth, fighter landing, all boarding steps, ship ownership, space patrols and Mars arrival. This checkpoint continued it through all three pumps/Corn/repair, the actual north exit, deliberate Warden download failure and normal retry, then the complete excavation route. No later-stage progression or HP was injected by these pilots. They are automated normal-input runs in an isolated section save, not human pacing or physical-phone acceptance.

- earned-mars-relief-journey-report.json: three released pumps, Corn completion, field repair, reload.
- earned-mars-route-entry-report.json: failed model request preserves the saved state and prior active scene; retry enters normally.
- earned-excavation-journey-report.json: patrol 6.137s, pressure gate 7.601s, boss introduction 10.195s, victory 71.639s, actual dash 72.347s, return/reload complete 83.205s; 197 shots, 190 hits (20 patrol + 170 boss), zero deaths/injuries, 100 final vitals. The pilot actively avoided warnings and used shield. Repair was not needed in this run; its actual consumer has controlled damage/repair tests.
- excavation-mobile-report.json: native desktop touch emulation and four layouts, plus full/low actual draw costs. This includes the subsequent gate-frame revision.
- excavation-focused.log: actual GLTF assets and node targets, protected core, supply restart, mining telegraphs, finite hazards, route guards, atomic failure/duplicate/reload behavior, pointer activation, collision/occlusion, real palm shots, repair/dash, conversation holds, actual death/retry panel, reconstituted checkpoint and failed victory-save retry. Eight deliberately broken controls fail behavioral assertions.
- warden-roundtrip-v02.log and excavation-roundtrip-v03.log: exact runtime inputs survive Blender import/export/re-import with equal triangles, bounds, embedded map count and named world-node positions. Private verification exports do not overwrite runtime inputs.

The first separate warden1 fixture cleared the patrol/gate, followed by a boss-only run from its earned arena checkpoint. Its 72.363-second follow-up excludes that earlier patrol. The earned journey above is the complete contiguous excavation report.

## Assets and quality

| New runtime model | Bytes | Triangles | Private master |
|---|---:|---:|---|
| Margin Warden | 2,241,964 | 25,616 | enemies/margin_warden/blender/margin_warden_v02.blend |
| Mars excavation | 1,789,176 | 26,892 | worlds/mars/excavation_v03/mars_excavation.blend |

Required hero/Warden/terrain/drone models total 7,797,580 bytes, plus 900,000 bytes reserved renderer code, below 12MiB. The Warden's actual Blender bounds are approximately 28.55m across tools, 26.43m long, 9.4m high. Eight explicit pylon/core/muzzle/cutter nodes are preserved; terrain preserves six entry/gate/frame/service anchors. Warden has three embedded maps; terrain one. Authoritative hashes/consumers are in manifest and ASSET_LEDGER. All originals, generated sheets/albedos, .blend masters and verification exports remain private.

The Warden uses original generated armor color plus existing original manufactured normal/roughness maps. The terrain uses the existing original generated Mars regolith color. These are authored modeling studies and optimized game derivatives, not recovered canon. The physical cutter, tracks, armor and installation remain provisional in detail; this is not final photorealism. Hostile controls and hazards are red; restored controls, services and liquidity abilities turn neon #00FF00. Allied costume identities remain intact.

## Current verification and performance

Clean npm ci, all 51 npm test validators, tsc/Vite build and restarted-browser visual/error checks pass. The eight excavation controls deliberately break core shielding, warning timing, route guards, dash collision, elevated-hit collision, secondary-touch activation, gate occlusion and failed victory saving; each is detected by a behavioral assertion. Dependencies/lockfile remain unchanged. The inherited dependency audit still reports four advisories, and the existing deferred-chunk size advisory remains; no unrelated upgrade or threshold change was made.

Initial JS 293,393bytes (86,474gzip, level6). The four deferred JS chunks together are 801,967bytes (210,020gzip, level6). The bundler's largest shared deferred chunk happens to be named MarsRelief; reporting only the smaller MeshRuntime file would omit the shared renderer. Embedded model images total 26,214,400 decoded RGBA bytes (25MiB, ten images). This excludes mipmaps, mesh/animation buffers, shadow/frame targets and other renderer overhead.

Current 600.170-second controlled soak: 62,189 frames, six space/excavation cycles with stable 30 geometries/12 textures at the entry checkpoint, and stable 37 geometries/12 textures after combat warm-up. Real shooting/hazards continue; hero life and tower HP are deliberately replenished only in an isolated in-memory performance rig. No campaign progress is written. Zero page errors; projectile and hazard caps hold. This is desktop HeadlessChrome152, Windows, 390x844, DPR1, not handset evidence.

| Profile | Frame interval p50 / p95 / p99 | Maximum interval | CPU submission p50 / p95 / p99 |
|---|---|---|---|
| Full | 8.7 / 23.2 / 30.3ms | 101.3ms | 1.4 / 2.9 / 4.0ms |
| Low | 7.7 / 16.6 / 21.1ms | 49.3ms | 1.1 / 2.3 / 3.0ms |

Sampled combat cost is about197,700-198,100 submitted triangles /62-65 calls at Full and98,700-99,100 /28-31 at Low. CPU submission is not GPU timing. Frame-time spikes are retained in the report; this does not prove a locked60FPS. Evidence: excavation-soak-report.json, excavation-asset-cost.json and excavation-build-sizes.json in the local evidence directory.

## Remaining work

Later rebuilt worlds, further material/geometry/animation refinement and physical-phone play/performance remain. The Fog Moon node is discovered but this checkpoint does not rebuild it. Continue the approved campaign after securing this milestone. No merge/release, main change, private-reference upload or wallet work.
