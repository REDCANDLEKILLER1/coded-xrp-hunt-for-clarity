# Fog Moon - connected implementation checkpoint

Current local implementation connects restored Mars to Fog Moon through the existing captured-Warship flight controller. Corn's post-restoration conversation points to the new route. The owned ship retains its real hull, fore/aft shields, fighter choice and separate progression tracks. A new optional route ID preserves existing Earth-to-Mars saves. Plotting constructs the next scene before committing the new route; a failed model load retains the previous route.

The moon has a real globe, range-gated fighter descent, a physical canyon, Boo, two relay banks and the fixed Fog Relay Citadel. Boo's Reveal lasts five seconds, with twelve seconds between activations. It identifies a genuine letter/shape among false feeds; verified relay clues persist. The west archive unlocks the east uplink. Six finite drones defend the shelter and relays. Citadel reflectors expose rotating genuine feeds, with real elevated projectile targets, committed red laser lanes and seekers. Victory recruits Boo, retains Reveal, restores public signals and discovers Bullion Reach. The selected fighter and owned ship remain reachable.

## Verification

- Clean npm ci, all 53 validators, and TypeScript/Vite build pass after the final Corn conversation and arrival-control corrections. No dependency or lockfile changed. The inherited four toolchain advisories remain; no unrelated upgrade was made.
- `validate-fog-moon.mjs` checks old/new route separation, safe migration, range-gated descent, preserved upgrades, failed storage, duplicate rewards, retained relay progression, real model hashes/animations/feed nodes, Reveal timing/range and bounded hazards.
- `validate-fog-scene.mjs` uses the actual scene and models to exercise simultaneous touch movement/fire/Reveal, modal timer holds, physical palm-origin feed hits, harmless warnings, old-scene recovery, death/retry and failed victory-save recovery. Seven deliberately broken versions are detected.
- `fog-journey-report.json`: isolated ordinary-input run, 111.071 seconds through shelter, Boo, both relays, Citadel, return and orbit reload; zero deaths/page errors, 80 final vitals. This is an automated controller run, not human pacing. Later label/control/cap refinements are covered by the mobile check and next earned run.
- `fog-mobile-report.json`: native desktop touch emulation at 390x844, 844x390, 360x740 and 1024x768. Independent movement/fire/Reveal/Dash, selective release, cancel and rotation pass; all six actions fit with non-overlapping tap targets. Full/low detail draw costs differ. This is not physical-phone acceptance.
- `earned-fog-voyage-report.json`: the original earned journey1 returned from Mars's completed excavation, spoke with Corn, ascended, plotted and flew all three Fog Moon patrols, crossed the portal, approached the moon, descended in its selected fighter and reloaded. Deliberate globe and Boo request failures retained the old route/surface boundary and were recovered through the real Retry controls. No later-stage grants or HP were injected. The subsequent earned surface/boss continuation passed and returned to orbit/reloaded. An initial browser reload timeout and a helper reading conversation telemetry before the next frame interrupted the controller; both left the actual game/save intact. The successful continuation began at the open Boo conversation, lasted 105.163 seconds including return/reload, and restored Fog at 85.777 seconds with 96 vitals, 184 cumulative shots, 105 hits, three injuries and zero deaths/page errors. The Citadel fight clock was 45.461 seconds. This is not a fresh landing-to-return measurement or human pacing.
- Exact Boo, Citadel, globe and final canyon GLBs pass Blender import/export/re-import. Named anchors and static geometry survive; Boo retains three clips, one embedded map and four anchors.

## Assets

| Runtime model | Bytes | Triangles | Private source |
|---|---:|---:|---|
| Boo | 415,752 | 9,064 | characters/boo/blender/boo_master_v03.blend |
| Fog canyon | 1,622,336 | 23,808 | worlds/fog_moon/v03/fog_canyon.blend |
| Fog Relay Citadel | 516,900 | 11,368 | worlds/fog_moon/v02/fog_citadel.blend |
| Fog Moon globe | 1,043,852 | 36,480 | worlds/fog_moon/v02/planet_fog_moon.blend |

The original private generated vapor and basalt maps have exact prompts/hashes in their local provenance records. Citadel hardware reuses the original generated Warden armor material. No master/source/reference image enters the public repository. Boo is an original provisional interpretation of the recovered written character audit; the original canon PNG was not located and was not newly inspected. His body has no limbs, with a deformable taper and expressive floating animation. Further realism and material refinement remain.

The actual selected Ledger Warden surface model set totals 6,694,076 bytes. Nine embedded images imply 22,020,096 base RGBA bytes; this excludes mipmaps, geometry, render targets and driver overhead. Actual final build files measure 294,585 initial JS bytes / 86,770 gzip, and 839,617 deferred JS bytes / 219,259 gzip across all deferred chunks. These are actual file bytes; all deferred chunks are summed rather than reporting only the named MeshRuntime chunk.

## Current performance and lifecycle

The current Fog runtime completed a **600.383-second controlled combat soak**, 63,510 frames, split into five minutes Full and five minutes Low at 390x844, DPR 1. Six repeated space/surface cycles returned 41 active geometries and 10 textures; sustained combat warmed to 61/11 and stayed there. No page errors occurred. Active projectile/hazard counts remained bounded. Samples retain the initial warmup and every thirty-second interval.

| Measurement, milliseconds | Full | Low |
|---|---:|---:|
| Frame interval p50 / p95 / p99 | 8.70/21.80/29.70 | 7.60/18.20/25.20 |
| Maximum frame interval | 55.50 | 49.80 |
| Scene update/render submission CPU p50 / p95 / p99 | 1.50/3.00/3.90 | 1.20/2.40/3.10 |

The actual renderer and scene run in an isolated in-memory test fixture. Hero life and boss HP are replenished, and the genuine feed is held open to sustain actual shots/hits and committed lane/seeker hazards. It is durability/performance evidence, not earned progress or boss pacing. Frame intervals are browser scheduling observations, not GPU timer measurements or a locked-FPS claim. The first 120 frames per mode are omitted from percentiles; maxima are retained. Browser: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/152.0.0.0 Safari/537.36`. Physical-phone thermal behavior and acceptance remain unverified. A failed initial JSON-document navigation was recovered before measurement; it did not change campaign progress.

Evidence in the local parent evidence directory: `fog-soak-report.json`, `fog-soak.log`, current Full/Low screenshots, `fog-cost-report.json`, `fog-mobile-report.json`, the two earned journey reports, exact runtime roundtrip logs, and final clean install/test/build logs. No private source sheet or master is part of that public runtime package.

## Review state and remaining production

This is a connected internal checkpoint under the full approved build. Secure/push only the working branch and verify its exact-head draft checks before claiming remote success. No merge/release. The hosted preview requires the owner's Vercel login; local tests do not substitute for hosted gameplay or physical-phone review.

Campaign-wide return travel and later chapters remain. The map currently continues the saved rebuilt route; selecting another world does not yet provide complete revisits. A later-world discovery alone is not evidence of rebuilt playable content. The initial relay-loop design shipped a traversable loop and usable Dash, but no separate Dash-only shortcut; this remains a traversal refinement. Fog flight uses authored finite patrols; deeper sensor-deception flight behavior remains a polish opportunity. Further geometry/material/animation refinement toward the requested realism is still required.

TruFi and Blue Umbrella remain allies, preserving blue/blue-gold identities with neon #00FF00 friendly cues; red denotes hostile control and danger. Next bounded scope is guarded campaign travel, Bullion Reach, LEX, convoy strategy and the Market Siege Engine under MASTER_PLAN section 13.
