# CODED: XRP — The Hunt for Clarity
## Astra Definitive Campaign Build — Master Handoff v1

**Plan ID:** CODED-DEFINITIVE-20260906-v1  
**Prepared:** 2026-09-06  
**Owner:** XRPMan / REDCANDLEKILLER  
**Repository:** REDCANDLEKILLER1/coded-xrp-hunt-for-clarity  
**Verified shipping baseline:** `6743368ad7a2a465c660eceeadc0ce380818dcc3`  
**Coordination:** PR #121; implementation must use separate branches/PRs.  
**Status:** Complete production brief, not a claim that the described game is implemented or approved to merge.

## 1. Read this as a new builder

You are taking over an existing playable game, not starting from an empty idea. The owner and builders have spent months establishing the world, responsive 2D combat, a campaign skeleton, assets, tests, and a working space-flight experiment. The owner likes the underlying game but is dissatisfied with repetitive enemy weapons, underdeveloped ground strategy, disconnected transitions, provisional materials, and a space section that still renders flat ship artwork.

Your assignment is to turn that starting point into one coherent, attractive, playable campaign. Make assets, write content, implement features, play, diagnose, and correct within this brief. Do not return after each asset or internal milestone asking what to do next. Deliver an integrated game for the owner to play and annotate. Use small, recoverable engineering changes internally; those are not owner approval meetings.

**Required first finished chapter:** Earth 2D battle → disable the Regulatory Warship → fly the personal fighter into its hangar → XRPMan explores a compact, real-3D boarding map → secure command → launch the captured capital ship → real-3D space combat → portal → Mars arrival. Then expand through the campaign below if the earlier chapter passes its internal gates. Do not build ten unfinished demos instead of one finished opening.

Existing custom art defines identity, not a ceiling on quality. You may improve backgrounds, build custom enemies, skin models, author new bosses and weapons, and write story content. Preserve recognizable characters, names, ownership continuity, and the controls the owner already likes. No Unreal migration; this stays a locally running browser game.

## 2. Evidence, instructions and creative authority

Keep four things distinct in your reports: (1) owner-established requirements, (2) inspected source/code facts, (3) new creative decisions made under this brief, and (4) measured implementation results. The narrative and later encounter proposals below are newly authored game design, not recovered character biography or already implemented lore.

The latest owner request expands the game-design scope to boarding RPG, characters, shops, real 3D, new art and later planets. The old no-interior direction protected a previous build; it does not mean resurrect the old side-view room game. Build the newly requested real-3D angled-camera experience instead. Preserve the former route as a rollback/legacy path until acceptance.

This brief supersedes earlier creative task stop-points such as “greybox only,” “no texturing,” “sprite-only transit,” and “hold other planets.” It does NOT override higher-priority workspace/security rules, grant unprovided credentials, authorize production changes, or permit merging. It is not permission to silently recolor established allied costumes or expose private reference images.

**Protected setup gate:** Three.js/WebGL is the proposed renderer. Existing repo rules protect lockfiles and workflows. No explicit dependency/lockfile exception was recovered during planning. Before editing protected dependency lockfiles, obtain one scoped owner approval for Three.js plus the required matching development types and lock resolution. Record that approval once. Do not infer it from this document, bypass it through CDN/vendoring, or ask repeatedly. While pending, continue backup, source audit, 2D work, story authoring, Blender production, materials, rigs and test preparation. Workflow changes remain separately unapproved; running tests locally is mandatory. No optional physics, UI framework, paid service or engine migration is bundled into that request.

Autonomy is broad for reversible creative and implementation decisions inside the approved game scope. Ask only for missing permissions, paid costs, destructive operations, irreconcilable identity changes, or a genuinely blocking product decision not settled here. Never manufacture work merely to occupy a target number of hours. Model/tool quotas and session limits are possible; checkpoint and resume rather than promising a completion time.

## 3. Preserve the starting point before modifying anything

The uploaded `coded-xrp-hunt-for-clarity-main.zip` was checked here:

- 19,599,183 bytes; 197 files / 234 entries.
- ZIP integrity/CRC: PASS; no unsafe paths or symlinks detected.
- ZIP comment: `6743368ad7a2a465c660eceeadc0ce380818dcc3`, matching the separately checked main ref.
- SHA-256: `7f09088ea1394442703d6c8b002a5e6755a2308c9176073b5aacf92ebbe91eba`.
- This is a tracked-source archive, NOT a Git history backup, local-save backup, copy of open PRs, or Blender-master backup. Archive integrity is not a gameplay test.

Create a local timestamped savepoint outside the checkout before starting. Keep the uploaded archive unmodified. Record current main, every source PR head you will use, current branch, working-tree status and asset-master hashes. Preserve relevant Git refs in a local bundle and run `git bundle verify`; preserve permitted uncommitted project changes separately without overwriting the owner's workspace. Do not inspect, print or upload secrets/env/wallet files. Preserve private masters locally, without adding them to a Git bundle or game ZIP by accident.

Suggested private locations:

- `C:/Users/Michael/CODED_SAVEPOINTS/2026-09-06_pre_definitive/`
- `C:/Users/Michael/CODED_3D_MASTER/`
- a new sibling checkout/worktree for the definitive build, never the owner's only checkout.

Prove rollback by extracting/restoring to a separate test directory, locating the manifest and package files, and recording which build checks pass. Do not test restoration by resetting or deleting the original checkout. Write `RESTORE.md` with exact source paths, hashes, commit, prerequisites, and commands actually verified. A source ZIP alone does not preserve installed dependencies or browser localStorage.

Do not touch main, close old PRs, delete branches, force-push over another builder, deploy production, or merge any PR. Recheck the base before writes. Preserve other builders' work. Claim the new task on #121 so only one builder owns each active implementation scope.

## 4. Ground truth and salvage map

The inspected baseline is Vite/TypeScript with Canvas2D top-down gameplay and custom perspective-projected Canvas sprites in `space3d`. `package.json` has no runtime dependencies. A real GLB renderer is not installed. The image manifest has five enemy keys, ground assets, six exterior boss entries, six old interior images, and an empty `weapons` category. A named source image does not establish a runtime consumer or mechanic.

Read the relevant modules rather than reinventing them: `Game2A.ts`, `registry.ts`, `EarthFlightEncounters.ts`, `EarthThreats.ts`, `EarthBossFlow.ts`, `RegulatoryWarship.ts`, `MissionDirector.ts`, `missions/ledgerPrime.ts`, `CampaignPlanets.ts`, `CampaignProgress.ts`, `DirectBoardingRuntime.ts`, `OnFootGame.ts`, `InteriorRooms.ts`, and the `space3d` modules. The old interior still has data/assets, but `main.ts` routes boarding directly to space at the inspected baseline. Resolve that contradiction deliberately for the new route.

Open PRs are salvage candidates, not a merge queue or proof of shipped features. Inspect their own changes at current heads, dependencies and overlap:

| Candidate | Useful work to evaluate |
|---|---|
| #108 | Intermediate Earth bosses, stage-inheritance fix, capture-contract tests and honest timing model |
| #110 / #111 | Pause/save work and portrait/input fixes; inspect their older bases |
| #107 / #113 | Maxed-upgrade scoring and centre-lane/barrel parity fixes |
| #114 | Shield readability and visible hulls |
| #115 / #116 | Combat/art plan and manifest-consumer validation |
| #117 / #118 | Enemy doctrines, difficulty decoupling and bounded boss escort screens |
| #119 / #120 | Ship weight classes and weapon-family implementation; #120 depends on #117 |
| #103 / #105 / #106 | Earlier competing doctrine, ground-threat and ladder implementations; do not combine blindly |
| #109 | Flight/attitude work; some intent is already incorporated in main #112 |
| #122 | Model-derived hardpoints and test lessons, but not the desired real-3D presentation |

#122 was verified open/draft at `4a66b494ac7f4ba262a4d5abfa20de95450b18ca` during this planning pass. It renders a 3.8-second sprite reveal and alternates two shots among four mounts. Salvage useful math and tests; do not keep polishing that slideshow as the final deliverable.

Make `SALVAGE_LEDGER.md`: source PR/head, contribution, KEEP/ADAPT/SUPERSEDE, reason, landed checkpoint, tests retained. Compare ancestry as well as diffs; an open PR may contain already-shipped work. Preserve attribution. Rebuild only where it serves the new coherent design.

## 5. Sources and asset-production policy

The five split packs passed CRC and matched their supplied SHA-256 checksums in this planning pass. They are independent archives, not volumes to concatenate. Start with Part 1 ACTIVE_CANON_LEVEL1, then the loose-source and clean-library packs. The v7 bundle is present at 263,816,989 bytes with 235 archive entries and passed CRC. These verified files must not be confused with earlier corrupt uploads reported in old discussions.

Use the curated local reference index from Astra Pass 03: 96 logical references / 95 images / 12 sheets, as reported by Astra. Use the nine character sheets and `CODED_CHARACTER_REFERENCE_REVIEW_v1.md` for identity. Source locations can differ between project files and local downloads; locate by filename/hash rather than assume a Windows path exists in every tool.

Warship master: `regulatory_warship_master_v03.blend` under `CODED_3D_MASTER/regulatory_warship/production_foundation/`. Astra reported approximately 119.9968 × 81.4833 × 25 m; LOD0 19,250 triangles / 1,026,512-byte GLB, LOD1 11,128 / 858,328, LOD2 5,156 / 417,696. These are production reports, not new independent mesh audits. Revalidate actual files before integration. The 135.21 m collision proposal is oversized and must not become literal gameplay collision.

You may regenerate or repaint every weak environment image, but do not replace good source art just to produce more files. Give each required asset a gameplay consumer, identity anchor, dimensions, visual target, license/provenance and byte budget before making it. Generate missing support views; never trace contradictory generated dimensions as if they are measured blueprints.

Private layer: raw references, character sheets, prompts, contact sheets, .blend masters, high-resolution renders, intermediate audio and unused variants stay outside the deploy repo. PR comments get concise text and explicitly permitted game-output/model-only review images, not private source sheets. Do not upload private imagery to an external image/model service without permission for that service.

Runtime layer: optimized local WebP/PNG for 2D; real optimized GLB/glTF derivatives and needed textures for the proposed mesh branch once its asset contract is approved. Manifest is source of truth; every entry has a consumer, every reference resolves, unused entries/files fail validation. Existing image preloader must NOT try to decode GLBs or audio as images. Extend by asset type and lazy scene bundles. Keep a single authoritative asset catalog; do not create two conflicting manifests. No raw ZIPs or master files in the game repository.

## 6. Art direction: modern CODED, not a retro reskin

Target grounded, cinematic sci-fi: believable proportions, readable armor, differentiated skin/cloth/metal, controlled roughness, intentional light, shadows, surface detail and recognizable original designs. Corn remains a corn-headed hero; Boo remains a ghost. Realistic rendering must not erase the characters.

Faction rule: green `#00FF00` identifies liquidity, XRPMan's energy, friendly objective markers and restored systems; red identifies hostile fire, corrupted control and enemy shields. Preserve blue TruFi costumes, blue/gold Blue Umbrella, black/gold IMUTV and other supplied character identities. This is the production default chosen to reconcile the owner's allegiance rule with the sheets, not a claim every old costume was green. Use icons/shapes as well as color for threats.

Make PBR textures/materials for the actual 3D models: base color, roughness/metalness, normal and selective emissive detail. Light dark metal with an environment/key/rim treatment; black albedo plus darkness is not realism. Keep green/red emission from clipping to white or hiding the hull. No baked poster background, accidental illustrated shadows or illegible generated lettering in UV textures. Put XRPMan/XMΣMΣ and other important labels in correctly authored text/decals.

Test final materials in the intended browser camera, not only Blender. Validate color-space settings, normal orientation, alpha edges and GLB material export. Keep final textures distinct from the v03 proxy materials. Model silhouette-sized details; bake small detail where it helps. Use efficient hair/clothing and restrained effects rather than depending on expensive simulation.

## 7. Story spine — new campaign design

**Premise:** Under an in-universe “Clarity Act,” the Suits promise safety while a Directorate seizes liquidity routes, hides the ledger behind engineered Fog, and diverts value from inhabited worlds to the Zero Point. This is fictional meme satire, not a factual claim about a real law, bank, regulator or named person's conduct.

Clarity is not the enemy. It is the truth that reveals what happened. Liquidity means the flow that keeps this fictional civilization functioning: energy, transport, food, communications and choice. XRPMan restores that flow; he does not become the new owner of everybody else's money.

**Act I — Break the blockade:** Earth is losing services. Stone detects discrepancies, Corn reports civilian consequences, and XRPMan discovers that the invasion is a cover for extraction. Gary Fog protects the deception. The Regulatory Warship carries a route ledger; capture it rather than destroy the evidence.

**Act II — Follow the drain:** Mars reveals Earth is one node in a network. Allies are encountered gradually, unlock practical capabilities, and make the captured ship a mobile home. Every planet exposes a different control mechanism, not merely a differently colored enemy wave.

**Act III — Make the record public:** The enemy's answer is not a bigger theft but a final command to freeze everything. The crew coordinates to defeat FINAL CLARITY's false promise, expose the Zero Point and return control to the worlds. End with visible restoration and a playable return to the ship, not a score screen alone.

Tone: heroic urgency, memorable short exchanges, absurd corporate language used as satire, occasional character-specific humor. No long crypto lectures, market predictions or real-token payout promises. Use the exact names from canon. Dialogue/story assignments below are new fiction under the owner's creative delegation.

## 8. Earth: design the whole first chapter

Preserve the established intermediate-boss placement; do not repeat an earlier assistant's reordered list:

`orbital_approach → fog_belt → REGULATORY BEHEMOTH → ledger_city → CLARITY DESTROYER → defense_grid → GARY FOG → final_assault → REGULATORY WARSHIP disable → boarding → new 3D interior → bridge secured → 3D departure/combat → portal → Mars`.

### 8A. Orbital approach and Fog Belt

Begin with a brief distress transmission, the recognizable fighter, Earth curvature below and evidence of a blockade. Teach one threat before mixing it. Fog conceals distant scenery, never incoming attacks or the player. Drifting wrecks and meteor lanes create paths; give each collision hazard trajectory, anticipation and a safe answer. Do not scatter rocks merely to add clutter.

The Behemoth closes the Fog Belt. Its theme is a moving shield wall with vulnerable maintenance windows. Defeating it opens the route to the city; it cannot capture a ship or trigger boarding.

### 8B. Ledger City and the defense grid

Create distinct authored ground: transport lanes, power conduits, substations, damaged rooftops, evacuation corridors and enemy installations. Backgrounds, foreground props and collisions must agree. Ground structures scroll at ground speed; airborne ships occupy a separate visual layer. A painted tower is not secretly collidable.

Ground counterplay must be visible:

| Ground object | Attack/interaction | Player answer |
|---|---|---|
| Tracking turret | Short predicted bursts with a visible turning barrel | Change direction; break its firing line |
| Heavy cannon | Slow charged shell with an obvious muzzle wind-up | Commit to a dodge during the tell |
| Laser tower | Draws a danger lane, then fires along it | Leave the marked lane before activation |
| Missile silo | Bounded tracking rocket, then straight commitment | Bait the turn; destroy the silo or rocket |
| Plasma battery | Pulsed area/curtain denial | Cross during the gap; prioritize its power feed |
| Shield relay | Clearly links protection to adjacent guns | Destroy the relay, then exploit the exposure |
| Jammer | Interferes with navigation, not input or damage visibility | Disable it or use earned Fog Breaker |
| Friendly clarity beacon | Green/icon-labeled restoration objective | Fly through/interact; never shoot it to “rescue” it |

Introduce turrets alone, then combine air/ground pairs, then coordinated tests. Do not fire unseen lasers from offscreen. Do not make the sum of legal patterns leave no traversable safe space. A generator chain reaction should visibly disable connected defenses. Surface victories restore green infrastructure and change dialogue.

The Clarity Destroyer closes Ledger City: lane-control beams, clear movement windows and distinct red hull identity. Defense Grid then combines learned counters. Gary Fog is the Guardian; destroying his deception awards Fog Breaker Pulse, which immediately exposes the final assault route and matters against the Warship relay.

### 8C. Enemies that attack, not targets that wait

Preserve useful dodge/retreat behavior. Give roster entries distinct silhouettes, size classes, attack timing and weapon identities. Initial design: Regulator pulses; Fast Scout short attack-run bursts; Fog Raider crossing lasers; Rug Fighter charged plasma; Whale stand-off missiles/broadside. These are proposed assignments; reconcile competing old PRs into one registry, not multiple simultaneous doctrine systems.

Fast Scout and Whale source art are duplicates: create a deliberately distinct Whale mini-destroyer. It is a heavy normal enemy, not a boss. Retain medium and light identities; avoid scaling one sprite into every class.

Use weighted encounter slots (starting point light 1, medium 2, heavy 4) and an independent active-attacker budget (starting point 3). First attacks should usually begin 0.3–0.9 seconds after becoming visibly actionable, with longer tells for heavy damage. These are tuning seeds, not immutable laws. No untelegraphed bottom/rear spawn; no spawning on the player's position. Spawns can be above or safely announced from sides.

Difficulty increases through combinations, geometry, objectives and target priority. A weapon pickup must not instantly raise live enemy health/speed. Prefer authored sector/difficulty values fixed at encounter start; any bounded boss loadout adjustment must be explicit, cannot cancel progression, and must not update midfight.

### 8D. Bosses and pacing

No infinite escort shields: adopt the tested design intent of max 3 active screening escorts, a 6-second shield clock, 2 seconds removed per escort killed, and 12-second relaunch cooldown. Overload creates a punish window even when no escort is killed. Escorts must actually update during boss mode. Rework exact values only after demonstrated playtests, preserving bounded exposure.

Each boss needs an intro, two or three readable patterns, escalation, damage feedback and a distinct defeat outcome. Aim initially for about 35–90 seconds of ordinary boss combat at the expected loadout, not an instant kill or an immunity slog. Measure actual play separately from calculated DPS models. No claim of a 23- or 31-minute playthrough from a hardcoded constant.

Earth flight remains a substantial mission. Preserve existing authored content initially, then remove genuine repetition if necessary for the full chapter. A new encounter, counter, story beat or reward should occur every few minutes. Do not pad a duration with waiting or unreachable enemies. Report actual segment times, deaths and retry cost.

### 8E. Transitions

Finish the current encounter, clear danger, preserve state, animate the fighter/environment into the next area, show the location title, and resume. For a changed background use an approximately 1–2-second directional transition; when the environment stays the same, use a title/formation beat instead of sliding an identical image twice. Every boss inherits an explicit environment, never an unrelated wave-ladder fallback such as accidental DATA CANYON.

## 9. Weapons, rewards and shops

Separate three progression tracks: personal fighter, XRPMan and captured capital ship. Bombs/missiles, primary weapons and special abilities use distinct state and UI. A full bomb rack says FULL; it must not alter primary cadence, shape, speed or damage. Upgrade-card input must not consume the second tap of a bomb/fire gesture. Invalid or maxed choices are not offered as meaningful upgrades.

The owner wants weapon evolution with four upgrades per family. Implement five families with four clearly labeled stages each: starter BB/beam, Pulse, Rocket, Plasma, and Ledger/Hyper energy. Reuse nine available weapon concepts as visual anchors, not as proof there are nine finished mechanics. Stage IV must feel like that family's mastered form; the next family changes behavior, not only the name. Allow selection of unlocked families at safe points so a preferred style is not lost.

Starter advances through single/twin/tri/quad useful forward coverage. No wasteful player fan pattern. All volley layouts must reliably hit a centered narrow target; barrel purchases add useful lanes without opening a center gap. Pulse penetrates lines, Rocket supplies physical ordnance/splash, Plasma gives heavy deliberate impacts, and advanced energy adds bounded chaining or shield disruption. Keep special Fog Breaker and later character powers out of an endless main-gun ladder.

Add a capped rapid-fire upgrade track: actual increased firing frequency without lower projectile speed or damage disguised as an upgrade. Tune progression tables together. Tests cover per-rung damage, lane geometry, expected centered-target time-to-kill, target groups, rate and caps. A new rung must not be an involuntary regression in the basic combat it replaces. Do not apply dozens of escalating multipliers and compensate with equally inflated enemy HP.

At safe zones/ship terminals offer repair, one weapon/module purchase and inspectable descriptions. Use local fictional salvage/upgrade credits; rescued public liquidity is returned, not sold for profit by the hero. No real XRP, signing, wallets, NFTs, purchases or backend economy. Mission completion rewards have unique IDs so retries, dialogue repeats and reloads cannot award them twice. Prevent negative balances and incomplete purchases. Save the cost and unlock atomically.

## 10. Boarding RPG: a real place in the same ship

Disable the Warship's actual subsystems, retain its hull, open an identifiable hangar and fly the existing fighter into it. Save before crossing. Use a real 3D arrival/landing that ends with XRPMan exiting the stored fighter. Never change the fighter into the capital ship. No generic shuttle replaces it.

Build a compact angled-camera 3D map within the Warship's plausible usable volume: hangar → security corridor → junction, branching to engineering and an optional cache/rescue room → command access → bridge/core arena. Approximately 6–8 meaningful spaces are enough for the opening. Do not copy an old side-scroller map literally or scale an entire imaginary city into an 81 m-wide hull. Exterior boarding aperture, engine block and bridge need spatial continuity; enclosed spaces cannot overlap engines or empty blade tips.

The default is a readable angled third-person RPG camera, with wall/ceiling occlusion handling and a small map showing visited rooms and objectives. Implement an optional inspect/first-person view only after it works; do not let two control schemes jeopardize the required traversal/combat path. Metroid inspiration means ability-gated exploration, readable loops and revisitable secrets, not copied art, map layouts or mandatory platforming.

Teach movement, ranged Liquidity Blast, interaction and one dodge/defense in a safe hangar. Include doors, a terminal, loot, one friendly meeting, two short combat encounters and a command/core boss. Ledger Defense Core can be reauthored as the installed security intelligence, not another copy of a ship fight. Relay/cover/attack-window mechanics must be learned before punishment. Ledger Shield is earned here and demonstrably useful afterward. No escort softlock because a companion cannot path through a doorway.

Bridge capture completes ownership and visibly brings friendly systems online. Restore damaged sections gradually; do not repaint all inherited red industrial fixtures instantly. The ship becomes a persistent hub for NPC interactions, inventory, upgrades and navigation. It is not necessary to build every deck or decorative room before flight is available.

## 11. Characters and dialogue

Use the supplied sheets and their reviewed constraints. Create source records for all nine, then prove a fully skinned/rigged/animated XRPMan in the real browser before replicating the pipeline. Use compatible humanoid rigs where appropriate without making bodies identical. Boo is a separate non-humanoid rig. NPCs need not all be playable combat classes.

| Character | Identity constraints | Narrative production default |
|---|---|---|
| XRPMan | Brown hair, green eyes, athletic, 6 ft 4 in / 1.9304 m, black/green suit and X emblem | Playable lead; rescuer rather than liquidity hoarder |
| Stone | Preserve command/broadcast identity; tactical and broadcast clothes are separate variants | Earth comms, later bridge coordination |
| Corn XRPL | Corn head, sunglasses, leaf features, yellow/gold/green field identity | Civilian stakes on Earth comms; met physically in Mars relief work |
| Mr Zamn | TruFi blue heavy armor, shield and gauntlets | Meet aboard the Warship securing survivors; later defense/armory support |
| LEX / Stake N Bake | One character, blue TruFi command identity, bald/bearded/glasses/medallion | Met in Bullion Reach; logistics and repair economy |
| Optimystic Prime | Exact spelling, blue/gold Blue Umbrella, hair/head wrap | Later fleet/mobile-command ally, not a generic pilot reskin |
| V4X / Victory4XRP | Masked identity stays concealed; hat/cloak; no invented revealed face | Later evidence and corruption missions |
| Niall Cottrell | Black/gold IMUTV, signal tools, low-combat support | Later broadcast rescue/public-evidence role |
| Boo | Limbless floating ghost: no arms, hands, fingers, sleeves or legs despite conflicting new sheet | Fog Moon scout; expressive eyes/body/trail |

Roles/meeting order above are newly authored defaults under the creative brief, not biography extracted from images. Stage introductions: characters are not standing everywhere before the player meets them. Recruitment flags control hub presence, dialogue, shops and abilities. Main quest cannot depend on an unintroduced optional character. Give each a distinct voice in text; do not assign ordinary crew a canonical name merely to fill a room.

Hero animation minimum: idle, walk/run, aim/fire, interact, hit reaction, dodge/defense, knockdown/recovery. Major NPCs need idle, movement and interaction relevant to their scenes, not eight unused attack sets. Validate rig deformation, foot placement and prop attachment. Keep meaningful costume materials: skin is not metal; black cloth is not gloss-black armor.

Dialogue is authored local data: stable scene/speaker IDs, short pages, trigger conditions, one-time quest effects, replay/log support, skip and accessibility controls. Two-stage advance: reveal text first, then advance; the touch ending combat must not dismiss a new conversation. Pause dangerous gameplay for mandatory conversations; optional radio barks do not take control. No runtime AI/API, paid voices or cloning. Text and existing music are sufficient.

Opening script anchors, editable for timing but preserve intent:

- Stone: “Ledger City is going dark. The reserves are still there. Someone closed every route.”
- XRPMan: “Then we open them. Send me the signal.”
- Corn: “Pumps stopped. Freight stopped. Their collector ships sure didn't.”
- Gary Fog: “Your request for clarity is pending review.”
- XRPMan: “Keep the paperwork. I'm here for the people.”
- Stone, before the Warship: “Don't destroy it. That ship has the route ledger.”
- Mr Zamn, at boarding: “You opened the bay? Good. Help me get these people through it.”
- Core: “Authority transfer denied. Liquidity is under protective custody.”
- XRPMan: “Protection doesn't look like this.”
- Stone, at capture: “Earth's routes are opening. The drain doesn't end here.”
- XRPMan: “Then neither do we.”

Author all required conversations, objective text and boss barks before claiming story complete. No TODO dialogue or disconnected introductory portraits.

## 12. Real 3D flight, not the old reveal

Use a WebGL mesh renderer for the actual ships, characters, interiors and primary projectiles. Three.js is the proposed technical path under the protected setup approval in section 2. Keep 2D combat Canvas-based. Do not rewrite the entire app in a new engine, or build a bespoke renderer merely to evade a dependency approval.

The captured ship must be the real optimized, textured v03-derived model in the scene. Show engine startup, departure motion and an exterior chase view, then offer cockpit/chase switching with matching ship position and controls. Use camera attachment transforms, not disconnected splash images. A 2D HUD is fine. Billboards are fine for sparks/smoke/distant stars; not for primary hulls or pretending flat bullets are volumetric weapons.

Preserve all nine nodes: `Ship_Origin`, `Muzzle_FL`, `Muzzle_FR`, `Muzzle_L`, `Muzzle_R`, `Engine_L`, `Engine_R`, `Camera_Chase`, `Camera_Cockpit_Forward`. Production Blender is meters, Z up, nose -Y; exported v03 was reported Y up / nose +Z. Establish one tested scene-root orientation/scale adapter; do not apply both the old sprite mapping and a new GLB mapping. Use the loaded nodes' actual world transforms.

All FOUR physical primary guns must be demonstrably active. Default to four visible bolts per volley at a tuned rate rather than quietly showing only two alternating shots. Hold GUNS fires continuously; release stops; no primary charge/release attack or overheat lockout. Side and forward mounts converge to a finite forward reticle point with a safe minimum range. No target snapping or shooting through the own hull. Use mesh capsules/bolts, modeled missiles and world-space beam geometry with readable trails/impact flashes. Projectile collision sweeps its travelled segment; visual location and hit location agree.

Reuse useful flight/AI concepts: bounded attack slots, approach/engage/extend/re-attack, damaged ships retreating without infinite oscillation, meaningful nose/flank/rear vulnerabilities, fore/aft shield banks, target range/closure and honest lead indicator. New models and source-derived skins for Regulator, Scout, Fog Raider, Rug Fighter and a distinct Whale. Do not promise a skin while delivering a colored cube. Verify enemies can intercept cruise speed and remain findable ahead; rear threats need radar/warnings, not unannounced spawn attacks.

Finger-drag remains primary. Keep two-finger steering/fire and the established optional double-tap hold gesture, with separate pointer ownership. No automatic tilt permission prompt. Body/camera orientation must survive loops without gimbal jumps or mirrored control surprises. Test equivalent maneuvers in portrait and both landscape holds; reset/pause/blur clears stale input.

Earth is a lit, rotating world-space sphere on departure, receding as you travel. The portal is the distant navigation objective, not a planet-shaped target pasted on the sky. Give the transit authored threats, a fight/obstacle payoff and a final safe approach. Portal entry and exit align heading/ship state; reveal Mars ahead. Not astronomical real-time travel; use game-scaled distance that sustains a several-minute mission without empty drifting. Record actual travel and combat times.

## 13. Campaign expansion — keep existing worlds, add the requested Mars

The inspected registry has ten destinations and no Mars. Do not rename `fog_moon` into Mars or repurpose old save keys. The new proposal inserts `mars` between Earth and Fog Moon, yielding eleven destinations including the existing ten. Replace an exact-count validator with route/key/clear-state invariants only when that content change lands. Preserve already-earned old unlocks through migration.

The route remains branching later: Earth → Mars → Fog Moon → Bullion Reach → Rugfall OR SEC Outpost → Whale Haven → Liquidity Depths → Court Nexus OR Regulatory Crown → Clarity Zero. Both side branches are playable/revisitable; do not require the player to erase a route choice. Each location has a unique encounter idea, restoration consequence, boss, reward and local story payoff.

| Destination | New authored mission/visual direction | Boss anchor and progression |
|---|---|---|
| Earth / Ledger Prime | Blockade, city grid, capture, introduction to liquidity theft | Existing Earth bosses and Ledger Defense Core; fighter special, character shield, capital ship |
| Mars (new) | Red geology against green restored irrigation; fight mining-route seizures and rescue relief infrastructure | New Margin Warden excavation carrier; Corn meeting and traversal/repair capability |
| Fog Moon | Sensor-dead canyons, false signatures, relays that reveal routes | Fog Relay Citadel; Boo introduction and a limited reveal ability; any Behemoth reuse is a named sister unit, not an unexplained resurrection |
| Bullion Reach | Fractured gold industrial world, bomber lanes and armored convoy route | Market Siege Engine; LEX logistics/shop unlock; do not clone Earth's Destroyer fight unchanged |
| Rugfall | Collapsing platforms/debris and baited extraction routes | Rug Puller Array; V4X evidence mission and counter-trap module; no second capture of the player's exact Warship |
| SEC Outpost | Fortified emplacement network, alternate cover approaches | Cyber Battleship / Enforcement Tower; rescue Niall's broadcast access, publish route evidence |
| Whale Haven | Large-scale vault docks, heavy ships and slow powerful volleys | Armored Dreadnought / Abyssal Vault; meet Optimystic Prime and secure fleet passage |
| Liquidity Depths | Luminous siphon infrastructure, drains and linked power controls | Siege Carrier / Drain Core; restore bulk flow and unlock advanced energy control |
| Court Nexus | Mechanical judicial labyrinth, rotating lanes, evidence terminals | Gothic Mech Vessel / Judgment Engine; defeat falsified authority, unlock one final access route |
| Regulatory Crown | Dense red command architecture and coordinated defensive batteries | Court Cruiser Prime / Crown Fortress; disable the other command route and expose Zero Point |
| Clarity Zero | Origin machinery, suppressed green energy revealed as systems fall | FINAL CLARITY / THE ZERO POINT; final coordinated battle, public restoration and epilogue |

Named existing destinations/boss labels come from baseline data; missions, Mars boss and recruitment assignments above are new proposals for this program. Astra may improve newly invented boss names, attacks, secondary characters and optional quests without consultation, recording the change. Preserve established cast and signature Earth bosses. Avoid multiplying two bosses per destination merely because two fields exist: design coherent encounters with distinct functions.

After the full Earth-to-Mars chapter passes internal end-to-end, art and performance checks, continue through these destinations without asking for a new brief. Use reusable modular systems, but give each a new layout, counterplay and story beat. A planet is not “done” because its map node exists. If limits stop the run, deliver the last complete connected playable endpoint, label remaining worlds accurately, and leave a precise resume state. The goal is the whole campaign; no promise that all planets finish today.

## 14. Architecture and persistence

Retain Vite/TypeScript and useful existing simulation modules. Separate scene ownership: 2D flight, transition, boarding 3D, space 3D, hub/dialogue and map. Use an explicit mode controller with enter/exit, input cancellation, asset loading, audio ownership and error handling. Only the active scene simulates. No hidden second game loop or duplicate music.

Use one lazily initialized WebGL renderer/context for 3D scenes where practical, not a new context every room. Pause/resume handles visibility changes. Resize/orientation recomputes cameras and touch layout. Dispose geometry, textures, render targets and listeners on release without disposing shared assets still in use. Render failures provide a clear retry/quality message, not a silent drop into 2D or a fake-3D fallback labeled success.

Extend persistence with a versioned, independently named definitive-build save. Read old progress through a tested adapter but never overwrite old saves during trial. Keep planet/checkpoint IDs stable; map removed acts explicitly. No automatic new-campaign reset. Add ownership, recruited allies, quest flags, visited rooms, shop purchases and three upgrade tracks. Save at safe boundaries; any exact mid-combat save retained from #110 must include new fields and pass roundtrip tests rather than silently ignoring them.

The transition contract is explicit and idempotent: intermediate boss defeat advances its act; Warship disabled enables entry; entry opens boarding; bridge capture grants ownership once; departure starts space; portal arrival unlocks/loads the destination once. Retries cannot double-fire events or rewards. Save before/after transitions, and handle interrupted loads. Test positive transitions and negative cases in one connected session, not only source regexes.

Create simple playtest entry points for Earth, boarding, space, a boss and a paused model/material review. Show a development indicator; use separate test saves. Refresh and retry stay in the requested test mode rather than dropping into the 2D campaign. Provide all exact URLs/keys on the final playtest card. Do not rely on the owner beating 20 minutes to inspect a three-second render.

## 15. Performance and finished-art acceptance

Initial engineering targets, not measured promises: 60 fps on capable target phones, stable 30 fps low preset; up to about 250k visible triangles and 100 draw calls in the low-profile representative scene, adjusted downward after profiling. Prefer 1K shared NPC textures and 2K hero/Warship atlases; use explicit LODs, instancing, pooled VFX, bounded bullets and few dynamic lights. Bloom is optional and never the only source of readability. Initial interactive 2D payload target <=5 MiB excluding streamed music; next-scene 3D bundle target <=12 MiB. Measure encoded bytes AND decoded texture memory estimates; a tiny WebP can decode large.

Do not preload every planet or the entire cast at boot. Load the current scene and prefetch the next at an appropriate transition. Geometry simplification must retain silhouette, muzzles and useful material differences. Caps are starting budgets; log justified changes, not cosmetic metric gaming. Textured GLB bytes can differ substantially from the untextured master report.

For each mode capture real runtime images on phone-sized portrait and landscape views, close enough to judge textures and distant enough to judge readability. Check hero face and costume, hull finish, ground depth, enemy tell, four-gun volley and dialogue legibility. Fix obvious faults before reporting. Include a low-quality preset comparison. Screenshots of Blender are not gameplay evidence.

## 16. Tests that must be able to fail

Run `npm ci`, `npm test`, `npm run build`, TypeScript checks where separate, and `git diff --check`. Record exact ref/environment and exit results. GitHub Build Check alone is not proof all validators ran; the inspected workflow historically omitted npm test. Do not edit a workflow without separate permission.

Keep tests attached to actual modules, not copies of implementation. Source assertions may protect wiring but cannot prove live behavior; strip comments, pin callsites, and retain behavioral tests. Apply a targeted mutation/control for each critical contract and verify it fails before trusting the test.

Required runtime coverage:

- Every enemy/ground doctrine fires its intended visible pattern; charges telegraph, seekers stop turning, danger remains avoidable.
- Weapon upgrades/caps/rapid fire/bombs remain independent and useful across all combinations.
- Every boss can be damaged, defeated and exited; escort overload and partial clear are separately exercised.
- Continuous Earth → capture → boarding → bridge → space → portal → Mars run succeeds; no debug event replaces the real transition under test.
- New game, death, room retry, save/quit, refresh, skip dialogue, skip transition, interrupted loading and duplicate events remain recoverable.
- Hero rig/animation/material export and every GLB asset/texture reference load in the browser; no silent missing-sprite fallback masks a model failure.
- All four gun nodes yield separated world origins across yaw/pitch/roll, finite forward convergence and actual hits; check camera-near clipping and own-hull obstruction.
- Two-finger steering/fire, pointer cancellation, leaving a button, orientation changes and UI captures work without phantom inputs.
- HUD/dialogue/shops remain readable at 390×844 and 844×390, plus smaller/larger representative layouts; physical device results are labeled separately from emulation.
- At least one ten-minute soak of representative combat and repeated scene enter/exit, with p50/p95/p99 frame time, asset memory estimates, errors and renderer counts. Do not present 144 Hz desktop rAF as a handset benchmark.

Test full normal-speed pacing without invincibility for the experiential report. Controlled invulnerability or act injection is allowed only in clearly labeled focused tests. No “ten seconds without damage while firing” failure unless the test establishes that shots should have reached an exposed boss. Do not confuse poor scripted aim or a dead test player with a gameplay defect.

## 17. Continuous delivery, not continuous interruptions

Before changes, write a short implementation/dependency map and identify overlaps. Work in focused branches/commits; preserve GPT's `gpt/<task>` and Claude's `claude/<task>` conventions. Continue Astra's established branch convention for its own new work. Do not impersonate another builder. Use an isolated integration branch/preview assembled from compatible tested checkpoints, without merging to main or resolving other PRs by deletion.

A full-program assignment does not authorize a big-bang rewrite. Finish each bounded internal phase, run the relevant tests, save a restorable checkpoint, and proceed automatically to the next approved phase. The owner reviews the connected playable result rather than every internal phase. A dependency/permission hold must remain explicit and cannot be solved by quietly widening scope.

Durable context files in the work branch:

- `docs/definitive/MASTER_PLAN.md`: this plan ID, later explicit amendments and source refs.
- `STATUS.md`: implemented, tested, visually checked, device-unverified, unfinished.
- `DECISIONS.md`: alternatives, chosen reversible decisions and reasons.
- `SALVAGE_LEDGER.md`: reused PR contributions/heads.
- `ASSET_LEDGER.json`: provenance, IDs, consumers, hashes, bytes and quality states.
- `TEST_REPORT.md`: commands, actual results, seeds and screenshots.
- `RESUME.md`: checkout/branch/head, local master paths, next exact task, blockers and commands.

Update these at real checkpoints, not every frame. PR #121 receives start, significant blockers and milestone/end links. No repeated “quiet hold” comments. Store the latest complete playtest URL, not a confusing set of stale branch previews. No claim that posting a comment woke a stopped Work task; request/read an acknowledgment when available.

## 18. Final owner handoff

Deliver one integrated preview/build, a short playtest card with section shortcuts, a source/restore package outside the deploy repo, exact branch/head, all runtime asset measurements, test report, known issues and continuation record. Keep the original main build untouched and usable for comparison.

Definition of success: the owner can play an authored Earth battle with meaningful ground strategy, capture the same recognizable ship, walk a correctly skinned/animated XRPMan through a purposeful 3D map, meet introduced characters, use upgrades/shops, fly real modeled/textured ships with visibly real four-gun fire, and reach an actual next destination through the portal. Completed later worlds must have their own playable objectives and endings.

Do not call it complete when it is a menu, a model gallery, a sprite slideshow, a blockout, a disconnected tech demo, ten recolored copies, an automated-test-only route, or a half-written story. Be exact about finished content and remaining limits. Stop for owner playtest after the completed program or a genuine resource/permission boundary, not after every small production step.

## 19. Source trail and interpretation boundaries

Source-derived: uploaded main archive and its checksum; the 2026-08-19 Level 1 plan (historical); five-pack manifest; nine character sheets and `CODED_CHARACTER_REFERENCE_REVIEW_v1.md`; baseline `CampaignPlanets.ts`, `ledgerPrime.ts`, `main.ts`, `package.json`, image/audio manifests; PR #121 production reports; #122 at the head noted above. Old plan sections conflicting with latest owner directions are not current implementation permission.

Newly authored here: campaign premise details, staged recruitment, Mars insertion, Margin Warden, location encounters, exact dialogue, tuning seeds, performance targets and the definitive execution program. Treat them as the proposed working design under the owner's broad creative assignment, not archival facts.

Technical references for implementation (check the installed version):
- Three.js docs: https://threejs.org/docs/ — GLTFLoader, MeshStandardMaterial, animation, instancing.
- https://threejs.org/manual/en/color-management.html
- https://threejs.org/manual/en/cleanup.html
- https://threejs.org/manual/en/responsive.html
- Blender Python API: https://docs.blender.org/api/current/

These technical references do not grant package, license, account or spending permissions. Use only permitted tools, locally available approved services and correctly licensed dependencies/assets.
