# Earth story and ground strategy checkpoint

Owner direction remains neon #00FF00 for friendly systems, red for enemies. TruFi and Blue Umbrella are allies; their blue/blue-gold identities remain intact. No merge, release or engine migration.

## Implemented behavior

Seven Earth act conversations now use the shared fresh-input conversation panel over the original Canvas renderer. The real frame loop holds flight/combat during dialogue, clears held inputs, and resumes without spending stale bomb/pulse/pause edges. COMMS replays heard conversations without changing rewards. Interrupted and failed-save conversations do not partly commit. A completed introduction remains heard across map/redeploy/reload.

Authored ground guns now have distinct on-screen warnings and attacks: predicted turret bursts, charged heavy shells, finite locked laser lanes, interceptible missiles with 1.25 seconds of steering, and spaced plasma curtains. At most two ground guns wind up or beam concurrently. Offscreen guns cannot pre-charge. The same finite segment supplies a laser's warning, active rendering and collision. Actual projectile/beam origins use the rendered weapon's pivot and muzzle.

Relays visibly shield the guns in their authored group. Destroying a relay drops those shields, interrupts its connected fire and lights the service conduits green. Clearing the first linked installation triggers Corn's district-restoration conversation in a safe interval; its dialogue receipt and quest flag commit together. Reload retains the restored district. A jammer adds an explicit navigation-warning strip without obscuring hazards or changing controls; destroying it or using earned Fog Breaker removes its effect.

Green plus-marked clarity beacons are repaired infrastructure. Fly through one for a capped hull/shield repair. They survive primary fire, seekers and bombs, are excluded from seeker targeting, cannot cause contact damage and cannot award kill score. The introductory beacon has enough travel time to be seen before the next encounter; later optional beacons never stall an act.

## Played evidence and limits

`verify-earth-story.cjs` launched normally from the map and fighter selection in a separate story1 save. Held/repeated Space, fresh advancement, combat hold/resume, portrait390x844, landscape844x390, replay, map exit and redeploy passed with no page errors. Those are desktop browser viewports, not an actual phone.

`ground-city-journey-report.json` records an ordinary-input continuation from the previously earned Ledger City checkpoint in neon-play. It crossed all23city groups, the Clarity Destroyer and all27defense-grid groups, reaching Gary Fog after335.30seconds with zero deaths and five hull points. The district-restoration quest and four relevant dialogue receipts were earned and saved. This was an automated controller, not human pacing, and it did not replay the earlier orbital acts. No completion state or rewards were injected. New gun artwork/muzzle offsets followed that run; they received focused collision checks, full validators and browser visual inspection.

`ground-visual-report.json` and eight own-game screenshots are explicitly isolated render studies: linked guns, repair beacon, actual laser warning/active beam and jammer, each in portrait and landscape. They inspect real rendering and attack state; they are not campaign progress or native-touch acceptance. The original full journey1 save remains preserved.

All48 validators and the TypeScript/Vite build pass. Meaningful added checks exercise actual Game2A frame/collision paths, linked protection, relay destruction with bolts/seekers/bombs, beacon immunity/repair, missile steering expiry/interception, warning intervals, bounded concurrent ground attacks, laser safe lanes and atomic restoration receipts. The old seeker source-wiring assertion was updated for the friendly guard/shared damage path; actual collisions are tested separately.

## Runtime art and cost

Eight original built-in image-generation derivatives replace the provisional support props and blue/green ground-gun appearances in Earth campaign mode. No private source reference was used or uploaded. The opaque first jammer study was rejected; its transparent edit is the runtime source. Generated perspective/material detail remains provisional art, not final photorealism.

Runtime assets live under `public/assets/hazards/`: shield_relay_v1, signal_jammer_v2, clarity_beacon_v1, tracking_turret_v1, heavy_cannon_v1, laser_tower_v1, missile_silo_v1 and plasma_battery_v1 WebP. Total116,398bytes; decoded RGBA1,176,576bytes. Each has a manifest entry, byte/hash/size ledger record and a real GroundDefense/Game2A consumer. Generated alpha is preserved; runtime preparation only resized and encoded the originals.

Private originals and prompt sets: CODED_3D_MASTER/worlds/earth/ground_sites_v01 and ground_guns_v01. Root evidence includes ground-art-prompts.json, ground-jammer-edit.json, ground-gun-prompts.json and both packing scripts. Originals remain outside the game repository.

Current initial JavaScript281.51kB/83.28gzip; deferred3D734.06kB/191.88gzip. The existing deferred-chunk advisory remains visible. No dependencies changed in this checkpoint; the prior successful npm ci remains the installed dependency baseline.

## Continue

Finish definitive five-family/four-stage fighter progression and capped rapid fire, safe loadout selection, the real Mars relief-site/Corn handoff, directional environment transitions, further geometry/material/animation quality and sustained performance testing. Retake the connected opening after these features settle. Physical-phone play remains an owner release gate; it does not block independent production. Do not expand the later worlds before the opening's internal gates pass.
