# CODED: XRP — The Hunt for Clarity
## Chapter One: Break the Red Lock — master production handoff v1.0

Prepared 2026-09-06 by GPT for XRPMan and the Astra production session.
Repository: `REDCANDLEKILLER1/coded-xrp-hunt-for-clarity`.
Coordination: PR #121. This document is a production brief, not a completion report or merge approval.

## 0. Read this first: why you are here

You are joining an existing game, not starting an empty project. XRPMan describes roughly three months of work: an enjoyable top-down shooter, authored encounters, bosses, controls, saves, extensive original artwork, music, character sheets, and a recent Blender production pipeline. Preserve the valuable work. The assignment is to turn those pieces into one coherent, modern, playable first chapter.

The owner does not want to manage every room, texture, test or pull request. Read this whole brief, create the safety copy, organize the implementation internally, and work through the permitted tasks continuously. Deliver a complete chapter for one consolidated playtest. Do not present another isolated splash image as a finished 3D game.

XRPMan owns decisions and release approval. GPT is planner, canon reviewer and auditor. Astra is the assigned production worker for this program. Claude's existing contributions remain valuable source material; do not delete, overwrite, close or merge its branches/PRs. Do not assume Claude or another agent has been stopped. Announce your branch/file ownership in #121 and avoid concurrent edits to another worker's checkout.

This handoff should be usable without access to the original chat. Project context is helpful; it is not a substitute for the explicit requirements below. No completion-time promise is made. A long-running session is allowed, not a requirement to waste time or produce an artificial activity count.

### The experience to deliver

**Briefing → Earth 2D combat → disable the Regulatory Warship → fly the personal fighter into its hangar → explore a compact true-3D interior as XRPMan → secure the bridge and recover the ledger evidence → take command of the capital ship → true-3D space combat → reach the portal → first chapter complete, Mars teased.**

The 2D Earth section stays 2D. The character/interior and new space sections must use actual 3D meshes with materials, animation where needed, depth and perspective. Text dialogue is sufficient; paid voices are not required. The final chapter must have a beginning, escalation, rescue, reversal, payoff and destination.

## 1. Authority, changed direction and protected boundaries

The owner's latest direction asks for a complete chapter, custom character models, a small 3D boarding map, a storyline and true-3D spacecraft. Earlier instructions that skipped the interior or preserved the projected-sprite space renderer describe the old build. They remain the rollback baseline, not this experiment's art target. Do not restore the old side-scrolling/Metroid section and call it the requested boarding game.

The new story beats and role assignments in sections 5–7 are authored proposals for this preview, not historical facts extracted from character sheets. The owner has delegated ordinary reversible design choices. Preserve named identities and explicit anatomy locks; document inventions.

**Still protected:** production `main`, releases, wallet/payment/blockchain code, secrets/.env, workflows, Vercel settings, other projects, private raw art and unrelated dependencies. No PR merges, force-pushes, branch deletion, destructive cleanup, paid API setup, purchases or wallet operations. Do not claim this document grants a missing permission.

### One explicit dependency/asset-policy gate

The intended renderer is Three.js/WebGL inside the existing Vite/TypeScript application, limited to the new 3D portions. Current `package.json` has no runtime dependencies. The standing repository rule protects lockfiles and only permits existing optimized image asset formats; a real mesh pipeline requires a narrow, explicit exception.

**Requested exception, not yet granted by publication of this document:** add Three.js and strictly necessary matching TypeScript types; regenerate only the corresponding package-lock changes; permit optimized, locally served GLB/glTF runtime derivatives and their declared texture resources, each referenced by a model manifest and consumed by gameplay. No unrelated upgrades, CDN runtime imports or workflow edits.

Ask for this permission once through the normal owner/tool approval path when it is required; the supplied `START_ASTRA.txt` contains the exact authorization wording the owner can send. Do not repeatedly ask aesthetic questions. While permission is pending, complete backup verification, local model/material/animation work, story data and permitted existing-engine work. Do not evade the rule by vendoring an undeclared library, changing a hidden lockfile, using a CDN, or silently substituting flat sprites for the requested 3D result. A dependency decision is not permission to change deployment settings.

If an active instruction conflicts with this plan, retain the stricter boundary, record the exact conflict once and continue independent permitted work. Do not invent approval.

## 2. Actual baseline and what has NOT shipped

Directly re-read on 2026-09-06:

- `main`: `6743368ad7a2a465c660eceeadc0ce380818dcc3` (PR #112).
- Created safety branch: `gpt/checkpoint-pre-chapter1-20260906`, pointing to that exact commit. This is a Git reference, not an offline backup of the owner's PC.
- PR #122: draft, unmerged; branch `astra/warship-3d-runtime`; head `4a66b494ac7f4ba262a4d5abfa20de95450b18ca`.
- PR #122 implements four physical muzzle coordinates but alternates two shots at a time; its exterior display is a 3.8-second, three-view image reveal in Canvas2D. It does NOT load the Warship GLB into a mesh renderer. Keep its useful math/tests; do not misdescribe it as finished true-3D presentation.
- Main's `package.json` uses TypeScript/Vite, no runtime dependencies. `npm test` is a chain of validator commands; count varies by branch. Report the actual count rather than copying an old total.
- The declared Earth mission still contains old interior acts/checkpoints, while the runtime handoff has historically skipped them. Reconcile mission data and execution deliberately, not by trusting one comment or an old timing model.

Inspect the real files and branches before altering them: `src/main.ts`, `Game2A.ts`, mission definitions/director, campaign progress, `DirectBoardingRuntime`, `space3d/`, old `onfoot/`, asset/audio manifests and the active validators. Read only relevant source; do not repeatedly scan every archive or unrelated project.

### Existing work to inspect and selectively reuse

These are pointers, not a command to merge a queue. Fetch current heads, identify each PR's own changes, inspect dependencies and verify whether equivalent work is already in main. Record the source SHA for every retained change.

| PRs | Useful material | Main trap |
|---|---|---|
| #107 | maxed-rank scoring | Do not lose queued rewards. |
| #108 | intermediate bosses, checkpoint/capture tests, timing corrections | Keep boss-stage fix; reconcile its removal of old interior acts with NEW boarding mode. |
| #110, #111 | save/resume and touch-lane fixes | Live-save serialization has maintenance cost; do not blindly adopt stale actor fields. |
| #113, #114 | center-first barrel geometry, shield/readability | Preserve aim coverage; shields must not hide ships. |
| #115, #116 | combat design/art requests; consumer audit | Design is not implemented content; category-wide reachability can hide unused files. |
| #117 | enemy weapon patterns; difficulty decoupling | Boss HP still samples loadout. Do not silently cancel every upgrade with matching HP. |
| #118 | escort simulation/cap, 6-second screen, timeout opening | Retain no-kill and partial-clear tests, not just ideal-play timing. |
| #119 | light/medium/heavy composition | Source Whale identity is duplicated; an outline overlay is not a final unique ship. |
| #120 | weapon-family mechanics and monotonicity tests | It depends on #117 and raises FIREPOWER_CAP to 80; never transplant that constant onto old scaling. |
| #103–#106 | earlier enemy/ground/ladder alternatives | Overlap with later work; select one coherent implementation, not both. |
| #109, #112 | flight/attitude history | Main #112 already includes related changes. Preserve finger control; do not accidentally restore tilt. |
| #121, #122 | Blender provenance, node contract, runtime experiment | #121 is coordination-only; #122 is not the promised mesh-based space mode. |

## 3. First operation: make rollback real

Do this BEFORE editing game code or modifying the existing master models.

Create a timestamped directory outside the repository, preferably:
`C:/Users/Michael/CODED_BACKUPS/pre_chapter1_<timestamp>/`.

1. Record the inspected main SHA, current checkout/branch, relevant open PR heads, tool versions and working-tree status. Recheck whether main moved. Never replace an owner's uncommitted work with a clean checkout.
2. Create a self-contained Git bundle containing the baseline and all fetched refs needed to preserve relevant work. Run `git bundle verify`; list included refs. Git bundles preserve Git objects/refs, not unstaged edits, unrelated untracked files, LFS payloads or the local production directory.
3. Also make a clean source-tree archive at the baseline commit and a local record of relevant uncommitted source changes (`git diff --binary`, staged patch, and explicitly selected untracked project files). Do not open or package .env, credentials, private keys, browser profiles or unrelated personal data. List excluded secrets as operator-managed without reading values.
4. Preserve the existing v03 Warship master, its handoff/verification files and package inventory in an external versioned copy, or verify an already-existing independent backup. Do not overwrite the v01/v02/v03 files. Raw source archives remain where they are; record their checksums rather than duplicating hundreds of megabytes needlessly. Verify LFS/submodule content separately if present; report missing payloads.
5. Restore the bundle/source into a NEW throwaway directory. Verify baseline HEAD/tree, run `git fsck` as appropriate, and run baseline build gates where tools permit. Open the restored baseline. Do not test restoration by resetting the working project.
6. Write `SAVEPOINT.json` and `RESTORE.md`: locations, SHA-256 hashes, included refs, excluded/generated files, exact safe restoration steps and pass/fail results. The restore target must be a new directory; no `reset --hard` or `clean -fd` on the owner's checkout.
7. Post one text-only #121 milestone: `BACKUP VERIFIED`, baseline SHA, private local paths and verification summary. Do not upload the backup or private masters.

Only a verified restore earns the word “restorable.” The remote safety branch already exists, but GPT has not created a local Windows backup for you.

## 4. Sources, asset identity and production standard

Expected private workspace:
`C:/Users/Michael/CODED_3D_MASTER/`.

Expected reference library:
`references/coded_canon/REFERENCE_INDEX.md` and `notes/CONTINUITY_FINDINGS.md`.
Astra previously reported 96 logical references and 12 contact sheets. Inspect that actual index rather than recurate everything.

Expected Warship foundation:
`regulatory_warship/production_foundation/` with `WARSHIP_3D_PRODUCTION_REPORT.md`, `WARSHIP_RUNTIME_HANDOFF_SPEC.md`, Blender/export folders and validation inventories.
Reported v03 dimensions: 119.9968 × 81.4833 × 25 m; LOD0 19,250 triangles, LOD1 11,128, LOD2 5,156. These are earlier builder measurements, not a fresh binary audit by this handoff. Reverify files/hashes before use. Six proxy materials and 35 editable assemblies are NOT final skins or a draw-call budget.

Project Sources also contain:
- `CODED_XRP_Hunt_for_Clarity_Clean_Asset_Bundle_v7.zip` (the approximately 265 MB decimal master/clean bundle).
- Five independent `CODED_XRP_ASSETS_PART_1...PART_5...zip` packs, listed in `CODED_XRP_5_PART_DOWNLOAD_MANIFEST(3).json`. Parenthesized duplicate suffixes do not signify a new version. No concatenation is needed.
- Weapon runtime pack, combat asset handoff and Claude asset brief.
- Nine character sheets listed below and `CODED_CHARACTER_REFERENCE_REVIEW_v1.md`.
- `Neon Horizon Defense.mp3`, `Boss fight 1.mp3`, `Coded the hunt for clarity theme song.mp3`.
- The August 19 Level 1 master plan: historical reference, not the authority for old side-view gameplay or claimed runtimes.

Test actual extraction/decoding and hashes. An archive directory listing is not proof its images are readable. Skip corrupt duplicate copies; use the verified split packs and live crops; report a genuinely missing source once. Do not state the originals are lost because one ZIP fails.

### Modern CODED art standard

Target grounded, cinematic sci-fi with the supplied custom identities. Not pixel art, primitive showroom models, a retro cockpit demo, or interchangeable stock spaceships. Do not erase Corn's corn head, Boo's ghost form or V4X's mask in pursuit of realism.

Use designed geometry, custom UVs and materials: distinguish painted metal, bare metal, fabric, skin, hair, glass and energy. Make surfaces readable in neutral light and black space. Use roughness/normal detail, restrained edge wear and sensible emission. Do not bake a poster's background, labels or bright highlights onto the model. Bevels/lighting and proportion matter more than arbitrary triangle counts.

Hostile gameplay energy and warning cues are red/orange; player liquidity effects and team cues use #00FF00. Preserve source costume identities: blue TruFi, blue/gold Blue Umbrella, black/gold IMUTV, Boo's white spectral form. Friendly markers communicate allegiance without repainting the cast. This reconciliation is a deliberate art-direction choice for the preview.

The captured Warship remains recognizably the same former enemy vessel. Red hostile systems shut down; selected control channels and friendly identification turn green. Do not replace it with a different hull or flood every surface with neon.

A model is not “finished” because its Blender beauty render looks good. Show it under the actual gameplay camera and dialogue camera, animated and lit in the intended renderer. Internal greyboxes are permitted while working; visible greyboxes/default materials cannot pass final delivery.

Private reference sheets, source-conditioned concept images, masters and contact sheets stay local. Repo assets are only optimized derivatives actively consumed by the build. Maintain separate image/model/audio registries as needed, no orphan art and no private-runtime fetches. Mesh/texture additions remain subject to the explicit exception in section 1. Share game screenshots/new-model review renders only through permitted attachments, not the deploy asset tree.

## 5. Story bible: Break the Red Lock

This is fictional comic-book science fiction, not allegations about real institutions or a financial product. “The Suits” are a fictional Directorate of extraction and control. Ruggers, predatory vault operators and red military enforcers serve it. Real community-inspired allies are represented by their supplied fictional character designs; do not fabricate real-world biography.

**Premise:** Earth has not run out of value. Its liquidity has been diverted behind a blockade and its records obscured by Fog. Local grids, relief convoys and civilian transport are failing while the Directorate's vault ships keep filling. Clarity means seeing the authentic ledger and restoring people's ability to use what is theirs. We save people FROM the Fog and red control; we are hunting FOR Clarity.

**XRPMan's goal:** Break the blockade, protect the evacuation route, disable the carrier moving the stolen liquidity, rescue the people trapped aboard and uncover its destination. He takes the Regulatory Warship because its vaults and route records must survive, not simply because a bigger ship is a prize.

**Chapter arc:** Stone intercepts a distress signal. Corn is keeping an Earth relay alive. Gary Fog hides the withdrawals behind false military traffic. After the air/ground battles, XRPMan breaks Fog's masking system, revealing the Warship. Disabling its systems opens the hangar but not its secured ledger. Aboard, XRPMan finds Mr Zamn protecting detained workers. Together they restore emergency power, defeat the security lock and copy the authentic route record. The final reversal: this ship carried only one part of the stolen liquidity. The next vault convoy used a portal toward Mars. Earth is stabilized; the wider Hunt has begun. XRPMan commands the captured ship through its first pursuit battle and secures the jump.

**Tone:** Capable heroes, serious civilian stakes, brief dry humor. Avoid nonstop token jargon, investment claims, lore dumps, generic “chosen one” speeches and endless bank jokes. The player should understand the objective without knowing crypto. Green restored relays and people returning to safety show progress. Cosmetic liquidity pickups are fictional resources, never payouts.

**Chapter ending:** Earth communications come back, rescued workers are safe, captured-ship ownership and evidence are saved, and the portal opens. End on Mars ahead/next destination with a clear chapter-complete state. No Mars surface level, ten-world campaign, multiplayer or NFT layer in this workload. The historical map's Fog Moon entry may conflict; do not rename/delete world IDs globally. Route this new chapter's ending to the authored Mars teaser and document the mapping.

## 6. Cast, appearance locks and actual chapter use

All nine character records must be indexed. A sheet is not a calibrated orthographic blueprint, existing rig or finished GLB. First produce coherent neutral views from ONE model, then animation tests. Generated supporting views are hypotheses and must not silently replace identity.

| Character / source PNG | Non-negotiable identity | Chapter use |
|---|---|---|
| XRPMan — `file_00000000ba4871fdbff678ce2302c42e(1).png` | Brown hair; glowing green eyes; athletic 6′4″ hero; dark suit; green channels; X chest/belt/glove identity. Duplicate without `(1)` is the same image. | Playable interior lead; radio voice in text; pilot of fighter then captured capital ship. |
| Stone — `file_0000000045f871fda02533d3fbefe7e2.png` | Recognizable head, green tie, command/broadcast identity. Tactical outfit and suit are separate variants. XMΣMΣ uses sigmas. | Command/comms during Earth, boardership systems guidance and ending. Choose tactical outfit for this chapter's portrait/model. |
| Corn XRPL — `file_000000000eac71f8b83b3fb6801db06e.png` | Kernel head, sunglasses, leaf forms, gold/yellow mantle, green armor. Not a human in a corn helmet. | Earth field ally at the restored relay; opening/midpoint/ending comms. |
| Mr Zamn — `file_000000008ecc722f8888a84d1b3fefdb.png` | TruFi heavy protector; blue armor light; circular shield; impact gauntlets. | Physical rescued ally/guide inside Warship; bounded defensive behavior, not a second full playable class. |
| LEX / Stake N Bake — `file_00000000ae08722fa1b82b451050a789.png` | One person, not two roster entries; bald/bearded; glasses/medallion; distinct blue TruFi command armor. | Later cast record; optional ending comms only if useful, no required combat model. |
| Optimystic Prime — `file_000000001ff0722f91bc9c4aae252f6b.png` | Exact name; head wrap, long hair, blue/gold Blue Umbrella identity. | Later mobile-command record; no bus/vehicle system now. |
| V4X / Victory4XRP — `file_00000000c8787230b5b375aa7267a659.png` | Mask, hat, hair, cloak; concealed identity. No invented revealed face. Crow is a separate asset. | Optional coded evidence message/next-chapter tease; no stealth campaign now. |
| Niall Cottrell — `file_00000000228c71f8a1e7081713c2e46f.png` | Black/gold IMUTV coat and signal tools; support role, sheet says low combat. | Later broadcast record; can relay victory in text without manufacturing a gunner class. |
| Boo — `file_00000000c4d0722f8adcf3a7a00b0f59.png` | Floating white ghost; expressive face; NO hands, arms, fingers, sleeves or limbs. New illustration's appendages conflict with prior explicit anatomy lock. | Later anti-rug scout record; no need to add an entire phasing mechanic to Chapter One. |

### Production order without owner micro-reviews

Build XRPMan's custom head/body/suit, UVs/materials, humanoid rig and clips; verify in a simple true-3D room. Continue into Mr Zamn with compatible animation conventions but different body/armor/shield proportions. Produce Stone/Corn conversation portraits from identity-preserving artwork or local models; choose full models only when a physical scene consumes them. Unused masters remain local.

Add one custom modular Directorate security-guard base and one civilian/worker base with small outfit variants for the interior. These are new background characters, not unapproved reskins of named allies. Scene crowd size must stay modest. Do not build all nine combat systems before the chapter works.

Minimum XRPMan clips: idle, walk/run, aim/fire, interact, hit, knockdown/recovery. Mr Zamn: idle, move, shield/brace and interaction. Background actors: idle/move and simple reaction. Test feet, shoulder/hip deformation, attached props and clothing intersections. No floating default mannequin or T-pose can pass. Use a compact expression set/face treatment for dialogue; full lip sync and paid voice synthesis are excluded.

## 7. Implementable chapter script and triggers

Use data-driven dialogue records with stable IDs, speaker, text, trigger, priority, repeat policy and optional future voice cue. Lines below are the starting script; polish phrasing conservatively, not plot or identity. Normal comms do not pause combat; critical objectives also appear in the HUD. Blocking room conversations suspend incoming damage and require deliberate advance. Provide skip/replay and full-text reveal; never make typewriter speed mandatory.

| ID / trigger | Speaker | Text |
|---|---|---|
| CH1_001 / briefing | Stone | Earth is still producing power. The Directorate locked the routes that carry it. |
| CH1_002 / briefing | Corn | Relief transports are grounded. I've got one relay left, and they're coming for it. |
| CH1_003 / launch | XRPMan | Keep that relay alive. I'm coming through the blockade. |
| CH1_004 / first clear | Stone | Those red signatures are patrols. Break the screen; don't chase every last one. |
| CH1_005 / Fog Belt | Stone | Traffic is disappearing from the ledger. Gary Fog is hiding a convoy. |
| CH1_006 / Fog Belt | XRPMan | Then we follow what he's trying to hide. |
| CH1_007 / Behemoth warning | Directorate | Unlicensed traffic. Surrender your vessel and its reserves. |
| CH1_008 / Behemoth opening | XRPMan | Those reserves belong to the people below. |
| CH1_009 / Behemoth cleared | Corn | You've opened the approach. City batteries still have the evacuation lane pinned. |
| CH1_010 / first turret | Stone | Ground battery. Watch its targeting sweep, then cross behind the shot. |
| CH1_011 / relay restored | Corn | There it is—green across the grid. The first transport is moving. |
| CH1_012 / Destroyer warning | Stone | Heavy ship on the city exit. It's covering the fortress, not defending the city. |
| CH1_013 / Destroyer cleared | XRPMan | City exit's open. Keep the transports moving. |
| CH1_014 / defense grid | Corn | They want you boxed between the towers. Leave yourself a way out. |
| CH1_015 / Gary arrival | Gary Fog | No clear record. No theft. That's how order works. |
| CH1_016 / Gary fight | XRPMan | That's how you hide it. |
| CH1_017 / Gary defeat | Stone | His mask is down. I'm transferring the Fog Breaker frequency. |
| CH1_018 / reward use | XRPMan | I can see the route now. It ends at that Warship. |
| CH1_019 / capital approach | Stone | Its vault holds the missing liquidity—and the route records. Disable it. We need it intact. |
| CH1_020 / subsystem objective | XRPMan | Guns, relay, engines. Leave the hull. |
| CH1_021 / disabled | Stone | Engines offline. The emergency hangar is opening. Bring your fighter inside. |
| CH1_022 / hangar landed | XRPMan | I'm aboard. The fighter stays here. |
| CH1_023 / interior objective | Stone | Command is isolated. Restore auxiliary power before you touch the bridge lock. |
| CH1_024 / corridor | Mr Zamn | Friendly behind the bulkhead. I've got workers with me. |
| CH1_025 / rescue | XRPMan | Zamn? Stand clear. I'm opening it. |
| CH1_026 / rescue | Mr Zamn | Good timing. Their idea of customer service needs work. |
| CH1_027 / engineering | Mr Zamn | I'll hold this junction. Get the emergency grid online. |
| CH1_028 / power restored | Stone | Local systems are yours. The command lock is still fighting us. |
| CH1_029 / optional log | Worker record | The reserve transfer was marked voluntary. None of us were allowed to leave. |
| CH1_030 / core entry | Security system | Custody transfer denied. Initiating ledger purge. |
| CH1_031 / core objective | Stone | Break the red relays. Do not destroy the archive. |
| CH1_032 / core secured | XRPMan | Purge stopped. Copy the record before we move anything. |
| CH1_033 / bridge claim | Stone | Record verified. Command transferred. The Regulatory Warship is yours. |
| CH1_034 / revelation | Mr Zamn | This isn't the vault. It's a collection ship. |
| CH1_035 / route reveal | Stone | He's right. Another convoy crossed a portal on the Mars route. |
| CH1_036 / Earth payoff | Corn | Earth grid is stable. Workers and transports are moving again. |
| CH1_037 / departure | XRPMan | Secure everyone aboard. We're going after the rest. |
| CH1_038 / space controls | Stone | Four primary batteries ready. Hold fire to engage. The missile system is separate. |
| CH1_039 / first pursuit | Mr Zamn | They've recognized the hull. They haven't recognized the crew. |
| CH1_040 / carrier threat | Stone | Missile carrier beyond the scouts. Clear it before you make the portal run. |
| CH1_041 / portal signal | Stone | Jump signature confirmed. That's the convoy's path. |
| CH1_042 / portal unlocked | XRPMan | Earth was one red lock. Now we know where the others lead. |
| CH1_043 / completion | Stone | Next destination: Mars. Keep the record safe. |
| CH1_044 / closing | XRPMan | We're not just taking it back. We're making sure everyone can see where it went. |

Dialogue must not announce a rescue, reward or ownership change before the actual event succeeds. Retry/reload must not duplicate rewards or replay every briefing. Save objective flags, not just which text box was last open. Nobody appears from nowhere: Stone/Corn stay on comms; Zamn is physically found aboard. Do not invent canon relationships to solve a missed trigger.

## 8. Part I — finish the Earth top-down chapter

Preserve pointer-follow responsiveness, collision generosity and the mobile shooting feel. Improve the existing implementation rather than rewrite it wholesale.

Correct sequence:
`orbital_approach → fog_belt → regulatory_behemoth → ledger_city → clarity_destroyer → defense_grid → gary_fog → final_assault → regulatory_warship → boarding`.

This preserves the previously chosen intermediate-boss positions. The Behemoth belongs AFTER Fog Belt and Destroyer AFTER Ledger City; do not move them based on an earlier assistant's mistaken summary. FINAL CLARITY remains future content.

### Enemies and density

Use light/medium/heavy silhouettes and weighted encounter budgets. Retain working dodge, retreat and approach logic. Build a distinct Whale/medium-heavy design from the source faction language when needed, not another enlarged Fast Scout. Do not open ship selection or NFT rosters as a side effect.

Initial design targets, subject to actual playtest: introduce one threat alone, combine two, then mix a heavy with light escorts. Start around 4–6 visible light-equivalent threats, build toward 8–12 equivalent threat slots; a heavy consumes several slots. These are tuning targets, not instructions to fill every frame. Boss escorts have their own cap. No enemies spawning underneath the player or attacking from the bottom without a designed warning; the owner rejected unexplained bottom arrivals.

Light units should make their first readable attack roughly 0.4–0.9 seconds after safely entering view, not wait for the end of a long station animation. Heavy attacks require longer visible anticipation. Keep an escapable route on both aspect ratios. Difficulty comes from combinations and counterplay, not instant HP inflation when the player's gun improves.

| Enemy role | Weapon identity | Player decision |
|---|---|---|
| Regulator Drone | short red pulse/energy bursts | keep moving, dispatch small pressure units |
| Fast Scout | narrow fast burst during a readable pass | intercept its path; do not trail it forever |
| Fog Raider | telegraphed short laser burst with fixed committed line | leave the marked lane |
| Rug Fighter | heavier plasma bolts, lower cadence | dodge the large slow impact, exploit recovery |
| Whale mini-destroyer | bounded tracking rockets, clear launch tell, finite tracking | prioritize the carrier or evade/shoot down missiles |

Use actual distinct projectile art/effects, not the same missile tinted five times. Sharing a pool/engine is good; erasing identity is not. Red hostile energy dominates without hiding armor or existing detailed surfaces.

### Ground and environment

Ledger City must read as a place: layered buildings, roads/utility corridors, damaged-but-readable civilian infrastructure, foreground scale and coherent scrolling. Turrets are mounted to the environment, not floating random icons. Enemy projectiles remain above decorative layers. No collision from decorative scenery unless clearly authored.

Introduce predictive basic turrets; telegraphed heavy cannons; laser towers with visible safe-lane tells; limited-tracking silos; and plasma-area denial. Show each before combining it with air attacks. Mines and meteors should create deliberate routes; meteors belong in orbital/debris zones, not arbitrary city clutter. Never stack beam/curtain patterns that close every exit. Ground destruction should have useful feedback and occasional resupply, without turning every building into a target.

One optional clarity relay in Ledger City is enough to express the story: clearing nearby hostile control lets the player activate it by a clear friendly interaction region; it turns green and advances the evacuation transmission. Do not add a full escort/fail-the-mission economy.

At authored area boundaries, freeze new attacks/spawns, preserve player state, transition over roughly 1–2 seconds, show the location and resume safely. When the stage actually changes, scroll the outgoing scene upward and bring the new one from below; give the fighter a short exit/re-entry staging beat where appropriate, then return control without a hidden hitbox. When only the act changes within the same stage, use the title/re-entry beat without sliding identical scenery. Boss acts inherit the intended location; never fall back to DATA CANYON by accident.

### Player upgrades: one coherent rule set

Treat the nine weapon source images as art, not nine automatically complete gameplay systems. Restore the owner's principle: a family develops through four ranks before the next weapon identity. Use a data-driven family/rank table, not several conflicting upgrade systems.

Chapter-critical track: starter ranks I–IV (single, twin, tri, quad parallel battery), then pulse I–IV. Include a visibly faster rapid-fire improvement in the capped starter/transition-to-pulse progression. Further family definitions are rocket I–IV, plasma I–IV and elite I–IV; their core identities may be implemented with the same framework, but later-chapter unlocks must not inflate this chapter's mandatory grind. First-chapter delivery requires the earned starter/pulse evolution plus useful missile ordnance, not twenty forced rank-ups before boarding. Preserve useful splash/shot-clearing code from #120 only where the actual family is enabled and tested; do not import its balance constants uncritically.

Every earned upgrade must improve or preserve centered-target effectiveness and provide a visible benefit. Test actual collision/DPS across every legal barrel/cadence combination, not only a spreadsheet or zero-barrel loadout. Use center-first fill for even volleys, symmetric parallel lanes, no aim-sized hole, no wider/slower gun caused by an unrelated pickup. Never offer a capped barrel/rack card that does nothing. Convert capped resource pickups to a small clearly labeled score award or another already-approved fallback; keep bombs, missiles and primary-fire variables separate. The overlay must not consume a residual double-tap; preserve/retest the arm delay and pointer release.

No instant enemy HP/speed change because a pickup was collected. Tune by authored act/encounter; any retained loadout scaling must be bounded, sampled at a defined boundary, logged and leave upgrades valuable. Do not copy FIREPOWER_CAP=80 into the old shared scaling path. Player fire should visibly hit ordinary centered enemies at useful range.

### Bosses, capture and timing

Retain Gary Fog's Fog Breaker reward and its immediate use against red interference/Warship relay defenses. Keep intermediate bosses distinct, with their own readable tells. Their defeats advance only their own acts; they never trigger boarding or space mode.

Use #118's tested escort-clock principles: escorts actually update during boss mode; hard live cap; partial kills shorten screening; timeout guarantees exposure even when no escort dies; cooldown prevents immediate re-screening. No invulnerability deadlock and no ideal-play-only verification. Avoid long invulnerable intros that look like bullets failing without explanation.

Regulatory Warship is disabled through batteries/relay/engines, not exploded. Preserve the evidence archive and hangar. A saved boarding boundary follows disablement. A visible entry marker guides the SAME personal fighter inside. Do not replace the fighter with the capital ship until command is secured.

Do not shorten the authored Earth act structure merely to claim a fast build. Treat roughly 20–25 minutes as an initial Earth design target, not a measured runtime or timer-based win condition. Historical 23/31-minute figures are not stopwatch results. Log real active-play time, deaths and replays in the completed integrated chapter; tune obvious empty repetition without deleting named stages.

## 9. Part II — physical boarding and compact 3D RPG

A new compact angled-camera 3D interior, not the old side-scrolling scene. Reuse safe persistence/input concepts, not stale map geometry by default. The interior must plausibly fit the v03 hull; bridge, rear propulsion and ventral-aft boarding zone should agree with the exterior. Exact internal layout is a design inference; document it rather than claim a previously approved deck plan.

| Space | Gameplay / story purpose | Completion |
|---|---|---|
| Hangar landing bay | Fighter comes to rest; XRPMan exits; safe movement/interaction introduction | reach emergency terminal |
| Security corridor | First visible red guard/turret; cover and aim/fire introduction | clear passage and open bulkhead |
| Engineering junction | Restore auxiliary grid; optional med/repair alcove | terminal activation after a small encounter |
| Detention/work bay | Find Mr Zamn protecting workers; short safe dialogue | unlock rescue door; Zamn joins locally |
| Command access | Two approaches around a hazard; one optional evidence/cache niche | reach security console |
| Bridge / core lock | Small authored security-relay encounter, then ledger copy and command transfer | verify archive, claim ship, choose launch |

Aim for approximately 6–10 minutes on a first interior clear; this is a design budget, not a claimed measurement. No open world, random maze, crafting tree, companion leveling or lengthy escort AI. Zamn can move between fixed safe anchors and brace/shield during one encounter; he must not obstruct the player or fail the quest because of pathfinding. Workers move to a safe anchor without a new escort-failure system.

Controls: camera-relative left-thumb movement, right-side attack/interact, clear contextual prompts; keyboard/mouse equivalents. Choose one consistent angled camera around 40–50 degrees downward, modest following, wall occlusion/cutaway when needed. No compulsory jump/platforming or free camera wrestling. Do not require phone tilt. Safely handle pointer cancel, focus loss, menus and orientation changes.

Combat starts with Liquidity Blast; give Ledger Shield after securing the security/core lock only if its actual counterplay is implemented and saved. Text explaining an unimplemented ability is not a reward. Separate personal fighter, XRPMan and capital-ship progression. Keep the fighter visible/stored in the hangar; it remains the owner's craft, not a discarded prop.

The bridge is the chapter's hub seed, not a promise that ten crew departments already exist. Show navigation, the evidence record, Mr Zamn and a launch interaction. Stone/Corn appear through comms. Claiming the ship persists once; reopening a conversation or checkpoint cannot duplicate it.

## 10. Part III — genuine 3D departure and space combat

After the renderer permission is granted, use actual optimized GLB spacecraft loaded into the new WebGL scene. Retain the original 2D engine and old projected-sprite space test as explicit legacy routes until review; do not force a wholesale renderer rewrite.

A screenshot sequence of the Warship is not the feature. The ship remains a real scene object throughout exterior flight. Begin with a short in-engine departure: hangar secured, engine systems come online, capital ship moves off Earth, chase camera settles. Provide skip/replay; skipping must reach the same gameplay state and rewards. No invisible preloaded screenshot substituted for mesh proof.

### One shared geometry contract

Preserve nine named Warship nodes: `Ship_Origin`, `Muzzle_FL`, `Muzzle_FR`, `Muzzle_L`, `Muzzle_R`, `Engine_L`, `Engine_R`, `Camera_Chase`, `Camera_Cockpit_Forward`.

The Blender asset uses meters, Z up, nose -Y; its normal glTF export used Y up and nose +Z. Derive the new renderer adapter from the actual export, document handedness/up/forward, and assert it with independent known poses. Do NOT automatically reuse the Canvas `(-x,-z,-y)` adapter or its 3 units/meter as a Three.js transform. Preserve labels from the vessel's point of view. One unit conversion boundary, not offsets scattered across weapons/cameras/collision.

Use actual world matrices for muzzles/engines and physically located cameras. Rig the player model under a root transform; camera views observe it rather than define an unrelated hull. Validate left/right, loops through vertical, rolled/inverted positions and chase/cockpit switching.

### Player battery and camera requirement

The owner must be able to SEE FOUR guns firing. Default primary action fires a synchronized four-muzzle pulse; not alternating pairs that look identical to the old two-gun system. Tune damage/cadence deliberately instead of silently doubling the old DPS. HOLD GUNS fires continuously, release stops; no primary charge, release attack, heat slowdown/lockout or steering suppression. Existing missile charge/lock and warp systems remain separate concepts.

Bolts/plasma are short 3D geometry or equivalent volumetric-looking mesh effects moving through world space, with perspective, length and depth occlusion. Missiles have actual body meshes. Flat smoke/flash particles are acceptable supplements, not substitutes for hulls and core projectiles. Use actual world collision/impact points. Four muzzle flashes, four separated origins and convergent trajectories must be distinguishable in slow-motion evidence and normal play.

Converge toward a finite forward aim solution; use a validated default distance and, where appropriate, the reticle's world hit point without auto-target snapping. Guard near-hull convergence and prevent firing through the player hull. Leads and lock display guidance only; no silent aim assist from the lead pipper. Use swept tests for fast projectiles and moving targets.

Default chase/exterior mode proves the full ship is present; add a cockpit/exterior toggle preserving attitude and aim. Cockpit can retain an approved existing UI layer over real 3D scenery, but not masquerade as a new modeled interior. Gun paths, enemy meshes and physics remain the same in both views. Finger-drag flight stays primary; simultaneous steering/fire and existing hold-double-tap concept should remain usable. No new tilt requirement or arcade-roll gesture.

### Enemy production and space mission

Build a small complete mesh roster from canon: Regulator Drone, Fast Scout, Fog Raider, Rug Fighter and a distinct heavy Whale. Reuse the canon Warship and one appropriate authored enemy heavy/boss design rather than invent ten new bosses. Final visible ships need custom surface materials, engine placements and meaningful class size differences, not anonymous boxes. Derive neutral front/side/back views from each actual model; maintain LODs and attachment conventions.

Assign pulse pressure, laser bursts, plasma, seekers and heavy volleys by role. Have approach/engage/extend/re-attack states and a capped simultaneous attack budget (start at three active attackers). Other ships reposition instead of all dumping weapons at once. Wounded ships can retreat and restore shields, but permanent hull damage must not trigger endless retreat/re-attack oscillation. Account for relative speeds so contacts can actually reach their engagement positions. Spawn visible arrivals ahead/at readable sides; behind-player threats need a radar warning, not unavoidable damage.

Mission arc: Earth recedes behind → first pursuit/systems lesson → mixed escort fight → carrier priority encounter → discover portal marker → final interception → clear jump lane → portal crossing/next destination reveal. The portal is the navigation objective; Mars is not a fly-there marker replacing it. Initial target roughly 6–10 minutes of active space play; tune empty travel without forcing a fixed duration.

Use spherical Earth and a restrained Mars reveal with local licensed/generated textures, simple appropriate lighting and rotation. Portal is actual scene geometry/effect with distance and radar markers; unlock only when the authored interception is cleared. Do not let a user skip mission flags by physically passing through an inactive portal. No Mars surface gameplay or new galaxy-map framework.

A complete chapter means the 3D part is playable through its objective and ending, not merely a mesh viewer.

## 11. Architecture, persistence and presentation

Use thin boundaries, not a new universal engine. Suggested responsibilities, adapted to existing names:
- chapter director: explicit modes/objectives/transitions and idempotent completion;
- Earth runtime: existing top-down simulation;
- interior runtime: scene, character controller, room interactions;
- space runtime: scene, flight, ship combat/navigation;
- dialogue content/controller: speaker records, line queues, safe input;
- model registry/loader: dimensions, clips, materials, nodes and budgets;
- shared progress/settings/audio: reused rather than duplicated.

A mode must own its input, timers, render loop and audio cue. Stop/hide inactive modes. On switching, clear held pointers/fire flags, dispose or pool resources deliberately, prevent async late loaders from reactivating a departed scene, and expose a safe loading/error/retry path. Do not let the hidden Earth canvas consume input or render behind 3D.

Use explicit new chapter save version/namespace in previews. Preserve old data; migrate only recognized coarse milestones, never repoint existing checkpoint IDs silently. Save mode, act/room, objectives, earned upgrades, crew rescue, ship ownership and chapter result. Make transitions transactional/idempotent; defeat resumes the latest safe boundary in the SAME mode. Interior death does not replay all of Earth; space death does not restart the whole campaign. Full bullet-level snapshots are optional only if correctly maintained; checkpoint reliability is mandatory.

Regression-test reload, retry, restart chapter, corrupt save, quota/storage failure and orientation change. Expose RESUME / RESTART / EXIT clearly. New preview data must not overwrite production progress. A room/space test shortcut must not mark the production campaign complete.

Music uses the supplied/local tracks through one director. Fade or crossfade between Earth, boss, boarding tension, bridge relief and transit; do not restart on every tiny act change. Short dialogue ducks music where useful. No simultaneous duplicate audio streams. Voices and external paid APIs remain off. Future voiceCue IDs can exist without audio files.

## 12. Performance and asset budgets — targets, not promises

Start with measured baseline and an adaptive low/default/high quality setting. Mobile readability is mandatory in portrait and landscape; landscape is preferred for the wide 3D scenes but portrait must remain usable.

Initial engineering targets:
- 60 fps on a capable phone; a stable 30 fps lower-quality fallback. Report actual frame times/device, not a desktop rAF interval as phone performance.
- Low-tier visible scene budget around 150k triangles and 80 draw calls; reduce heavy postprocessing/shadows before replacing characters with primitives. These are starting limits to validate, not universal hardware guarantees.
- Hero target about 15–30k triangles, 1–2 texture sets at 1K/2K; major NPCs around 8–20k; background bodies around 4–8k. Preserve essential face/silhouette before chasing a number.
- Warship can start from the 19,250-triangle shell; bake/atlas/consolidate materials for runtime without destroying the editable master. Enemies should be lighter and use LOD/instancing where appropriate.
- New 3D payload target <=20 MB compressed per mode, loaded on demand; image/mesh/texture/audio bytes reported separately. Avoid preloading every character and later-level ship into Earth.
- Limit skinning/transparent overdraw, real-time lights, shadow casters and particle count. Prefer baked lighting/normal detail and shared atlases; do not make flat unlit grey art the performance plan.

Measure transfer bytes, draw calls, triangles, decoded texture estimates, active clips/actors, load time, frame-time median/p95 and a 10–15 minute stress session when possible. Give viewport, DPR, browser, device/GPU and test mode. Emulated mobile input is not physical-phone validation; label it. WebGL capability failure needs an honest unsupported/legacy choice, not silent pseudo-3D fallback branded as the new build.

## 13. Autonomous work sequence and repository discipline

The whole chapter is one assignment. Its internal milestones are not owner review appointments.

1. Backup/restore proof, baseline playthrough, archive/PR/asset inventory, permission check.
2. Record one source-of-truth plan/status and selected reuse commits; create thin runtime/story contracts.
3. In parallel only where safe: Earth combat/environment completion; custom character/Warship/enemy material production; approved true-3D runtime foundation. Keep each file/branch owned by one worker.
4. Implement complete boarding story loop, then space mission; use real mode handoffs early rather than defer integration until the end.
5. Finish actual in-game art, dialogues, audio transitions and persistence; replace every chapter-visible placeholder.
6. Run full chapter, repair failures, rerun tests, produce one integrated preview and review package. Stop for audit, not for every internal step.

Use `gpt/chapter1-*` branches for this GPT/Astra program. Keep #121 as communication and the plan PR as documentation. Do not put game implementation on the existing production-log branch. Four to six coherent draft feature PRs are a reasonable organization, not a quota; each must have a narrow purpose and exact base/head. Use a separate integration preview branch assembled from explicit tested commits so the owner receives ONE combined game. Do not merge PRs or main, close old PRs, or force-push another worker's branch. Describe dependencies and superseded work without deleting it.

Avoid blindly stacking old PR heads whose diffs contain unrelated parents. Retain original author/provenance in cherry-pick/reimplementation records. Resolve old validators against the intended invariant; never disable them just to print green. Dependency/asset-policy exception, when granted, belongs in a narrowly scoped prerequisite commit with its exact version/diff recorded.

Post a short start claim, a meaningful integrated milestone and a completion/blocker report on #121. Updates should contain artifacts/SHAs/test evidence, not repeated “quiet hold” messages. Do not claim a repo comment itself keeps another session running; runtime permissions/limits still apply.

## 14. Tests that define done

Run `npm ci`, `npm test`, `npm run build`, `git diff --check` on each integration checkpoint and final exact head. Do not change workflows just because CI currently omits some local tests; report the distinction. A successful build is not a gameplay audit.

Required behavioral coverage:
1. Normal campaign start plays the authored Earth sequence; bosses appear in correct stages and advance correctly.
2. Enemy/ground classes actually fire their distinct attacks in the live runtime; telegraphs render; no spawn-on-player or impossible pattern combinations.
3. Upgrades preserve effectiveness, center coverage and cadence. Capped pickups cannot alter primary guns. Stale taps cannot purchase cards.
4. Escorts update in boss mode; cap, partial kill-cut, timeout and exposure all work. Test a player who kills zero escorts as well as a successful one.
5. Warship disable uses actual damage/subsystem paths. Entering its real hangar triggers the new interior. Neither intermediate boss triggers it. Do not call a hidden `show()` directly and call that an end-to-end handoff proof.
6. XRPMan renders as an animated custom mesh; movement, attacks, interaction, rescue, terminal, door and security/core encounter can all complete through normal input.
7. The archived ledger is copied; crew safety and command flags save once. Launch enters actual mesh-based space mode.
8. Four separate muzzles fire in each primary pulse; release/focus loss/cancel stops; steering remains active. Projectiles collide at valid world positions and do not pass through the player hull.
9. Each spacecraft is a real textured mesh. Orbit/move the test camera to demonstrate depth/parallax and occlusion. HUD/smoke sprites are fine; billboard hull substitution is not.
10. Clear the final space objective, activate portal, cross, save and reach chapter-complete/Mars tease. Prove no-kill/failed objective cannot complete it.
11. Save/reload and retry inside each mode return correctly with no double rewards, missing allies or return-to-2D surprise. Wrong/stale checkpoints fail safely.
12. Portrait and landscape simultaneous touch steering/fire, pause/dialogue input, orientation change and safe UI insets work. Document physical phone tests still needed.
13. Every shipped asset decodes/loads and has a real consumer; no private URLs, inaccessible Windows paths, raw masters, ZIP dumps or missing textures in runtime.

Critical assertions must survive deliberate negative controls: sever the mode handoff, remove a muzzle, collapse distinct enemy patterns, restore the escort deadlock, corrupt a save and remove a needed asset. The relevant check must fail for each. Use actual runtime functions, not a duplicate reimplementation that agrees with itself. Avoid source-word matches satisfied by comments.

Also play at least one full start-to-ending run WITHOUT state injection, invulnerability or forced objectives. Shortcuts are for focused tests, not completion evidence. Record real active-play time separately from development time, deaths and pauses. Provide a short end-to-end recording or timestamped screenshots of each mode transition. A material/face-quality pass must be visual, not solely a hash validator.

### Test entry points

Provide documented preview-only routes such as `?chapter=1&mode=earth`, `...mode=boarding`, `...mode=space`, `...mode=hangar-review`. Names are a new contract to implement, not existing URLs. Legacy `?space` may retain its old behavior, clearly labeled. Every shortcut must have retry/reload consistency and isolated test saves. Hangar review offers pause/replay so the owner can photograph the model instead of racing a 3.8-second fade. Give full clickable links on delivery; do not send the owner through the entire Earth level to inspect one gun.

## 15. Context-safe savepoint and completion report

Maintain `docs/production/CHAPTER1_BUILD_STATUS.md` on the active work branch after each durable milestone. It must contain:
- baseline and safety branch; verified local backup path/hash and restore result;
- plan version; current exact branch/head; integration/feature PR links;
- completed/verified items versus in-progress/blocked/proposed items;
- chosen dependency versions and the actual approval record;
- source asset IDs/hashes and export/master locations;
- scene/quest state, current test results and failing reproduction;
- next three concrete actions;
- unresolved decisions and what must NOT be changed;
- a ready-to-paste resume instruction.

Keep `DECISIONS.md`, `ASSET_LEDGER.json` and `TEST_RESULTS.md` alongside it, compact and current. Record labels such as VERIFIED IN RUNTIME, BUILDER-REPORTED, DESIGN TARGET and UNVERIFIED. Do not state percentage completion unless the denominator/checklist is clear. These files should let a fresh builder/auditor resume without reconstructing this chat.

If tools/time/context/usage stop the run, save a valid checkpoint and exact remaining work. Do not mark the chapter done, fake tests, schedule unsupported background work or delete difficult requirements. A partial result is acceptable as a checkpoint, not as the final promised experience.

Completion requires:
- one integrated playable preview link and mode shortcuts;
- exact build SHA and list of narrowly scoped draft PRs/commits;
- chapter narrative/quest/dialogue data;
- actual in-game XRPMan, ally/interior, Warship, enemy, projectile and transition evidence;
- master/runtime inventories and explicit licenses/provenance;
- full tests plus negative controls, frame/byte budgets and honest device limits;
- save/resume/rollback instructions verified in a separate restore location;
- remaining owner-playtest notes, no hidden blocker, no production merge.

**Do not finish by asking permission for the next routine step. Finish the authorized chapter, or leave a precise, restorable checkpoint explaining the real blocker. The owner's next substantial job should be to play the combined result and give one consolidated set of notes.**

## 16. Evidence pointers and interpretation

Repo facts were read through the connected GitHub integration on 2026-09-06. Recheck before implementation. Key pointers:
- main/ref and `package.json`, `src/game/content/missions/ledgerPrime.ts` at `6743368ad7a2a465c660eceeadc0ce380818dcc3`;
- PR #121 comments `5560016084` (v03 report), `5560050109` / `5560065948` (old runtime assignment);
- PR #122 at `4a66b494ac7f4ba262a4d5abfa20de95450b18ca` and `docs/WARSHIP_RUNTIME_SLICE.md`;
- local `CODED_CHARACTER_REFERENCE_REVIEW_v1.md` for source PNG IDs/hashes, costume conflicts and anatomy locks;
- source `CODED_XRP_5_PART_DOWNLOAD_MANIFEST(3).json` for independent archive hashes;
- August 19 plan for historical intent only; it is not the live baseline.

Technical references for the builder to check against its chosen versions:
- Three.js official installation manual: https://threejs.org/manual/en/installation.html
- Three.js official documentation / GLTFLoader: https://threejs.org/docs/
- Git bundle documentation: https://git-scm.com/docs/git-bundle

The story, tuning values, production order and budgets above are authored design decisions/targets, not external facts or proof of performance. A screenshot of a file or a builder report does not independently verify its contents. This handoff changes no runtime by itself.
