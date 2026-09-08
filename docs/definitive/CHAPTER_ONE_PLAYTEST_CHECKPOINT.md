# Chapter One review checkpoint — September 8, 2026

This candidate continues `astra/definitive-review` from `511748503235eded75c1498ac237552ef4ef1b10` for draft PR125. It is a development review build. No production release, merge, workflow/security change or source-art upload is included.

## Playable changes

Fresh starts use the Clarity Interceptor directly; the ship picker and nominal speed/attribute cards are removed. Existing saves keep their original stored fighter.

Earth–Mars includes a 720 m Red Candle Dreadnought; Fog–Bullion includes an 878 m Seizure Carrier. Five physical components support different attack orders: optional gun batteries, paired shield emitters, and an armored reactor. Actual hull geometry blocks shots. Broadsides commit three warned lanes; gun heat limits sustained fire. Brake and fore/aft charge routing provide real tactical controls. Component damage persists at checkpoints, and patrol rewards cannot bypass a live reactor or repeat on reload.

Bullion Reach adds three patrols with bomber lanes, an actual 480 m approach gate and original-fighter descent, LEX and two physical haulers, four combinations of freight lanes, scanner attacks, cargo repair, safe junction checkpoints, a moving rear-weakpoint siege engine, atomic physical delivery/recruitment and return travel. LEX's paid bridge logistics upgrade has a real repair-cooldown consumer. Both later coordinates are retained without claiming later missions exist.

The final polish clears held flight controls on rotation, prevents duplicate defeat panels, aligns Mars gate interaction and its button label with the visible control pedestal, and keeps navigation labels behind flight instruments.

## Art and asset evidence

The supplied Desktop art folder was inventoried and its 22 unique root sheets visually reviewed. Original sheets, contact sheets and Blender masters remain private. Runtime derivatives are manifest-registered and consumed by the existing scenes.

| Runtime derivative | Bytes | Triangles | Verified clips |
| --- | ---: | ---: | --- |
| Corn v11 mobile | 5,197,356 | 72,549 | Idle, Interact, Hit |
| LEX v12 | 3,971,012 | 44,559 | Idle, Walk, Interact, Hit |
| Boo v07 | 3,318,968 | 40,136 | Idle, Glide, Interact |
| Dreadnought v03 | 758,040 | 10,106 | Static component hierarchy |

Corn now has an exposed human face, fitted shades, kernel crown/husks, green armor and a gold cape. LEX has the broader face, black beard, mirrored aviators and gunmetal/cobalt TruFi armor. Boo has the revised expression and white spectral cloth/arms. Runtime renders, embedded maps/UVs, sockets, 90 sampled cast poses and Blender roundtrips were checked. Closed emitter geometry was verified after a decimation defect was repaired. Mr Zamn and XRPMan were compared with their supplied sheets. These are refined game models, not an assertion of final realism or owner art acceptance.

Two original generated flight skies are included: blue deep-space dust (87,508 B) and copper Bullion dust (62,408 B). [Background prompts and consumers](BACKGROUND_ART.md) are recorded. Largest Mars model set is 11,555,636 B; the existing per-scene 12 MiB download budget including its reserve remains enforced. No budget was relaxed.

## Verification and exact limits

Clean dependency installation, all 61 validators and the TypeScript/Vite build passed. The suite includes actual GLB collision/animation/material checks, convoy routes and physical delivery, storage failures, death/retry, reward deduplication, capital component locks, broadside timing, shield conservation and independent touch ownership. The pedestal regression exercises the rendered scene from its clear south approach. Existing build chunk-size and dependency-audit warnings remain recorded; unrelated packages were not changed.

A new ordinary-control campaign earned Earth defense, the original-fighter landing, boarding/capture, the dreadnought route, Mars relief/Corn and the excavation/warden/Dash, including return and reload. A deliberately interrupted excavation model download retained the earned save and physical scene, then normal Retry succeeded. Controller timing/range corrections were recorded; no completion, position, health or reward grants were used in this fresh journey.

A second journey continued the exact previously earned Fog landing snapshot restored after the earlier browser reboot. It earned Boo/Reveal, both relays, Citadel restoration, the Bullion voyage/carrier, range-gated descent, covered/west convoy delivery and return. Credits moved from 2,040 to 2,460 exactly once; both haulers survived at 80/140, LEX was recruited and reload preserved the outcome. Pilot aiming and return-path corrections were recorded without resetting the game. This is audited continuation, not a claim that both runs are one uninterrupted fresh campaign.

The final battle build punished a shield-first pilot that left both batteries active: hull loss at 112 seconds. A fresh battery-first pilot used height and flanking, destroyed all five components and reached Mars in 243 seconds with 164 hits and no page errors. These demonstrate distinct tactical outcomes under automated ordinary inputs, not human difficulty acceptance.

Separate ordinary-control section runs completed the other convoy combinations and returned to orbit: express/east 72/140 cargo hull, express/west 115/128, covered/east 113/140. Each received exactly one 420-credit reward and LEX; no page errors were recorded. Together with the earned covered/west route, all four combinations were exercised.

Native Chromium touch tests verified simultaneous steering/guns/brake in space and movement/BLAST/shield on foot, selective finger release, cancellation and rotation cleanup. Convoy controls fit 360×800, 390×844, 844×390 and 1024×768. These are browser-emulated devices, not physical phones.

Six space/surface resource cycles each returned to 68 geometries and 20 textures. A separate six-minute actual combat stress fixture held player/cargo/boss health, followed the rear control and sustained real shots/hits/hazards: 18,986 frames, over 1,500 shots, over 540 hits, no page errors, bounded hazards/projectiles, and stable 48 geometries/9 textures after combat warmup. Full/Low median controller+render submission CPU was 2.3/2.0 ms; p95 was 3.9/3.4 ms. Frame-interval p95 was 66.2/44.1 ms under concurrent desktop/headless test load. This is lifecycle/load evidence, not a phone frame-rate or thermal pass.

Detailed logs, playthrough reports and screenshots are in the private sibling `definitive-authorization` evidence folder. Key reports: `final-tactical-v2-report.json`, `earned-bullion-delivery-return-final.json`, `final-convoy-*-report.json`, `final-mobile-input-report.json`, `bullion-final-mobile-report.json`, `bullion-final-soak-report.json`, `chapter-20260908-mars-relief-journey-report.json`, and `chapter-20260908-excavation-continued-journey-report.json`.

## Recovery and review boundary

Before editing, 134 files totaling 322,849,032 bytes were copied to a private recovery set and every restored hash verified. An additional strategy-source backup was also restore-checked. The baseline commit above remains intact. To inspect the older review, use that commit in a separate worktree and build there; retain this branch and the private masters. No reset, force push or production rollback is required.

The owner's next step is real playtesting, art feedback and exported debug logs. Physical-phone feel/heat, difficulty balance and final likeness remain open review items. Further campaign expansion is held for this review. Hosted gameplay is only claimed if the exact deployed revision can actually be opened; deployment protection remains unchanged.
