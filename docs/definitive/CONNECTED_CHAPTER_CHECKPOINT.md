# Connected chapter and neon faction review

Development checkpoint under PR124; PR125 stays draft. This is not the finished campaign or release approval.

## Earned connected journey

The isolated review=earth&run=journey1 save was played from the normal map and Ledger Warden selection through every Earth act: orbital approach, Fog Belt, Regulatory Behemoth, Ledger City, Clarity Destroyer, Defense Grid, Gary Fog, final assault and Regulatory Warship. Actual aperture entry loaded the selected fighter's 3D recovery and boarding. No ownership grants, completion events or section preparation functions were injected into this journey.

The same run secured the hangar/security relay, met Mr Zamn, restored engineering, opened command, defeated the Core, earned Ledger Shield and captured the bridge. Repair and shield capacity were bought through the terminal. The departure briefing and actual departure button led to capital flight. Four patrols, portal conversation and portal entry reached Mars orbit in193.43 simulation seconds:438 volleys/1,752 projectiles,95 hits and27 incoming contacts. Hull stayed100; the shield module absorbed/regenerated damage. These are automated-run counters, not human difficulty or phone-performance measurements.

Final save: Ledger Warden, Mr Zamn, Ledger Shield, repair, shield capacity, all eight boarding steps, four unique patrol receipts, one Mars receipt, portal dialogue receipt and500 credits. Normal reload and return to the bridge preserve these values. No browser errors were recorded by the boarding/space helpers or subsequent visual recovery check.

The Earth controller initially kept selecting a visibly MAX barrel card. Combat correctly froze; the helper was stopped, corrected and resumed on the same live game. Approximately450 seconds of menu/controller idle contaminate Earth wall time: do not call it human pacing. No Earth/boarding deaths; Core combat ended at56 hero vitals. The boarding helper also needed one further ordinary INTERACT after the departure conversation to reopen the terminal. The separate departure helper completed that action without a reset or grant.

Evidence outside the deploy repo: earth-journey-report.json, chapter-boarding-report.json, chapter-departure-report.json, chapter-space-report.json, neon-browser-report.json, their ordinary-input helpers and own-game screenshots in the task's definitive-authorization directory. The initial boarding helper exited on its missing terminal reopen; the follow-up completed it.

## Corrections from the run

- Bolts, seekers and bombs share subsystem damage/completion. Seekers previously disabled the director without ending the actor's fight. The played run escaped when an ordinary bomb supplied the missing completion. Regressions now exercise each actual final-hit entry point, same-frame danger clearance, saved boarding checkpoint and one-time score.
- Capital defenders now move and age in campaign mode; the old branch spawned them without updating their movement/attack logic.
- Disabling the Warship clears residual escorts, hazards and projectiles before fighter approach. Controls remain live and the approach stays safe.
- Failed checkpoint storage refuses MeshRuntime destruction, retaining renderer/UI for retry. Failed-save and successful-retry teardown tests pass.
- Earth bosses draw their inherited environment instead of overriding correct stage metadata with boss_arena. Surface scrolling pauses with combat; stable alternating tile IDs match ground joins.
- Portrait guardian names fit. The opening landing shot fits every actual hull vertex at390x844 and844x390 without changing the measured fighter trajectory.

## Owner's neon faction direction

The owner tested flight controls and requested much stronger neon #00FF00 for allies, red for enemies. TruFi and Blue Umbrella are explicitly allies. Preserve their blue/blue-gold costume identities with green friendly markers/shared liquidity systems. The device was not identified, so this is not recorded as physical-phone acceptance.

Captured armor is green; engine/power channels emit pure green. Secured room service lights turn green while hostile rooms remain red. Mr Zamn retains TruFi blue with a green marker. Player lighting, navigation, health and action controls reinforce the same language. Own-game screenshots confirm these changes; no private canon sheets are uploaded.

Original built-in image generation supplied two environment edits: Earth with green civilization/energy networks and a straight-down industrial ground plate with neon service conduits. Private raw masters and PROMPTS.json remain in CODED_3D_MASTER/worlds/earth/environment_v02. Only optimized registered derivatives enter the game.

| Runtime image | Bytes | Dimensions | Decoded RGBA bytes |
|---|---:|---:|---:|
|earth_orbit_neon_v2.webp|72,252|1024x683|2,797,568|
|ledger_ground_neon_v2.webp|110,934|768x1152|3,538,944|

Combined image transfer183,186 bytes. The orbital image is a single slow-parallax horizon. The ground plate uses mirrored matching joins and remains a substrate for the unfinished city/restoration design. No new model bytes/dependencies for faction appearance. Fresh Mars frame10calls/28,322 triangles; captured bridge59calls/195,990 submitted triangles. Sampled scene cost is not a frame-time or device measurement.

## Gates and remaining scope

All48 validators pass after the 2D faction normalization. The subsequent dialogue allegiance addition passes its focused boarding gate and final build. Landing retains1,458 swept fighter-clearance samples; capital guns retain1,200 paths across75 orientations. TypeScript/Vite build passes: initial261.04kB/76.79kB gzip; lazy3D738.95kB/193.37kB gzip. Existing deferred-chunk advisory remains. Dependencies are unchanged from the earlier successful ordinary npmci; it was not rerun just for image/material edits.

The second ordinary-input run, neon-play, reached Ledger City through orbital combat, Fog Belt and Behemoth without the first helper's MAX-card delay. It stopped for environment review. The source environment images were also inspected, and actual game frames confirm the orbital horizon and city substrate are consumed. Later hostile cues and friendly 2D controls were normalized to red/green. Core dialogue now explicitly carries hostile allegiance; friendly voices keep green. Tags/icons continue to distinguish supplies, and a deliberately varied blue/gold/purple test uniform still verifies green shield independence.

Remaining: Earth story triggers, restoration/ground strategy, definitive five-family weapon progression, real Mars relief-site/Corn handoff, further modern-realism geometry/materials/animation, ten-minute soak and frame-time percentiles. Native touch has prior desktop-emulated evidence; physical-phone acceptance remains an owner gate before merge. Continue the opening before expanding later worlds. No Unreal migration, release or merge.
