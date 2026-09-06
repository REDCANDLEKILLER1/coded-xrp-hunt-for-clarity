# Captured Regulatory Warship runtime slice

Base: `6743368ad7a2a465c660eceeadc0ce380818dcc3` (main, PR #112). Implementation branch: `astra/warship-3d-runtime`. Production provenance and authorization: PR #121. Draft only; no merge authorization.

## Representation and route

Main uses Canvas2D perspective-projected sprites with a first-person camera, not a mesh renderer. This slice retains that renderer, movement, finger-drag input, missile/lock system, warp drive, shield system and existing canopy. Tilt stays disabled; the cockpit now correctly says **DRAG TO FLY**.

The existing `coded:boarding-complete` handler in `src/main.ts` hides on-foot play and calls `space.show()`. The same arrival now shows three v03 exterior views over its first 3.8 seconds, with a captured-state green label. The normal 6.4-second arrival and subsequent combat timing remain intact. The reticle and attitude indicator return after the reveal so they do not obscure the ship study. No additional story or cinematic framework was added.

Current main has no player chase/exterior gameplay mode to replace. First-person transit represents the captured vessel through its existing cockpit, geometry-derived battery and hull collision; the short departure reveal establishes its exterior identity. The reveal is a screen-space presentation, not a new world-space chase camera or a persistent mesh.

## Source and consumed asset

- Canonical private source: `regulatory_warship_master_v03.blend`, SHA-256 `fbb263377db27586528ccbf32b29dc1691611f1c1c3f3332e7b256d3faa818b5`.
- Derived from its own transparent renders at azimuths 150/180/210, downsampled from 1200×900 to 512×384 each, arranged horizontally and encoded WebP quality 84, method 6. These are Blender renders, not private source/reference contact sheets.
- Manifest slot `ships.captured_warship`: `/assets/ships/captured_warship.webp`, **35,540 bytes**, 1536×384, three 512×384 frames.
- SHA-256 `ad7b70c6c687170c301b433e3fa75a7bec9134dca91f94d1c51d365229ad9f3b` is pinned by the validator. Its consumer is `Space3DGame.drawCapturedWarship`, through the existing manifest preloader.
- The atlas preserves the pointed hull, swept side masses, gunmetal body and restrained orange/red systems. Green is ownership text, not a repaint.
- No GLB/LOD0, Blender file, generated support view, raw private reference or review screenshot is included in the deploy assets. Screenshots belong in PR attachments.

Uncompressed RGBA pixel storage is **2,359,296 bytes (2.25 MiB) per decoded atlas**. The existing game and space section have separate AssetLoader instances: conservatively allow 4.5 MiB for two decoded copies, plus browser/GPU overhead. Browser decode deduplication is not assumed or measured. The cold browser sample fetched the atlas once at 35,540 encoded bytes; localhost transfer took 4.9–6.5 ms. This is not an internet download benchmark.

## Scale, attachments and battery

`Warship.ts` is the single geometry adapter. One Blender meter becomes **3 runtime units**. Blender nose -Y, port +X and up +Z map to runtime right/down/forward as `(-x, -z, -y)`. Nodes are transformed relative to `Camera_Cockpit_Forward`, then through the inverse camera projection rotation, including bank. The accepted 119.9968 m hull is about 360 runtime units long. The surrounding universe retains its existing abstract scales.

All nine v03 node names and meter coordinates are retained. The four primary origins are the actual FL/FR/L/R node positions, not offsets guessed around the screen center. A held trigger alternates FL+FR and L+R every 0.17 seconds, two bolts per pulse. Each bolt aims at a point 1800 units along the camera's current forward ray. This is finite, forward reticle convergence, not target snapping. Bolts remain independent world-space projectiles after launch, so steering during flight curves the visible trail as expected.

No primary heat, charge or release-to-fire mechanic remains. Removing heat retains the former cold-gun two-bolt damage ceiling; sustained DPS is intentionally higher than the former overheated rate. Missile charging/lock, warp heat, flares and fore/aft shields remain separate. The existing projectile size, damage and audio are reused; bespoke capital-gun VFX/audio remain future polish.

## Collision

The oversized 135.21 m production envelope is not used. The gameplay hull is a forgiving central ellipsoid with radii **8/5/30 meters** in right/down/forward, or **24/15/90 runtime units**, centered at Ship_Origin. Blade tips do not enlarge the player's damage area. This is a deliberate gameplay proxy, not mesh-perfect collision.

Incoming bolts and seekers use a swept segment against the rotated ellipsoid, using the actual simulation step. Seekers add 10 runtime units of padding; contacts add their existing half-size. Shooting down a seeker retains a 62-unit radius, wider than the player's 34-unit transverse missile-damage radius. Player-projectile target collision and damage rules otherwise remain unchanged. Full relative-motion continuous collision and final balance tuning are outside this provisional slice.

## Verification and measured cost

`npm ci`, `npm test` (33 validator commands), and `npm run build` passed. Windows setup required restoring Rollup's exact locked 4.62.2 native optional binary locally; no dependency manifest or lockfile change was needed. Existing source validators assume LF checkout text; Windows CRLF caused an initial false failure, resolved by normalizing local checkout line endings with no substantive unrelated diff.

The new validator checks nine node names, four distinct origins, forward reticle convergence and swept collision across 75 yaw/pitch/bank combinations including pitch poles; actual held/released/touch-trigger battery execution; local atlas identity, size and manifest consumer; and the existing boarding-to-space route. Existing movement, attitude, secondary weapon and content validators all pass.

Mobile browser checks used Chromium on Windows, 390×844 and 844×390 CSS pixels, DPR 2, mobile/touch emulation. Real browser touch input held one steering finger and a second gun finger simultaneously:

| Check | Portrait | Landscape |
| --- | --- | --- |
| Four barrels during 2.3-second two-finger hold | 7/7/6/6 shots | 7/7/7/7 shots |
| Yaw / pitch change while firing | 1.35 / 0.98 rad | 1.50 / 1.09 rad |
| Release | stopped | stopped |
| Loaded images / missing / page errors | 59 / 0 / 0 | 59 / 0 / 0 |
| 300-frame rAF median / p95 | 6.9 / 7.0 ms | 6.9 / 7.1 ms |
| Frames over 33 ms | 0 | 0 |
| Render-function p95 during hold | 0.7 ms | 0.7 ms |

An unchanged-main desktop landscape sample measured 6.9 ms median / 7.1 ms p95 with zero frames over 33 ms. No frame-time regression was discernible in these short samples; this is not a controlled device benchmark. The display runs near 144 Hz. rAF intervals do not measure GPU memory, network conditions or sustained thermal performance.

Production JavaScript increased from about 238.27 KB / 69.54 KB gzip to 240.94 KB / 70.61 KB gzip: approximately **+2.67 KB raw / +1.07 KB gzip**, plus the 35.54 KB atlas. CSS is unchanged. No new runtime dependency was added. The optional `?warshipdebug` route exposes bounded, read-only DOM counters and render timing; normal sessions do not publish those diagnostics.

Manual browser inspection covered capture presentation, portrait/landscape flight and firing, and the existing Guardian encounter with all four barrels firing. Screenshots were inspected and overlapping reveal frames and the misleading tilt prompt were corrected. The complete 31-minute campaign was not replayed; handoff reachability is covered by the existing integration path and focused validator. Physical iOS/Android hardware, low-end thermals, a full encounter balance pass and GPU memory remain review follow-ups.

## Review and overlap

PR #109 (`claude/full-loop`) overlaps Space3DGame, Cockpit and the space-flight validator. Resolve that overlap deliberately if either PR lands; no changes from #109 were absorbed. Asset housekeeping PR #116 may overlap the manifest. Other open 2D combat/UI work was left out.

Changed scope is the Warship adapter, transit/cockpit integration, one consumed atlas and its manifest entry, the focused validator plus updated primary-fire assertions, package test wiring and this handoff. Wallets, payment/blockchain, secrets, workflows, lockfiles, Vercel, other ships, interiors/RPG, planets/portals, unrelated gameplay and final PBR are unchanged. Stop at the separate draft PR for GPT/XRPMan review; do not merge.
