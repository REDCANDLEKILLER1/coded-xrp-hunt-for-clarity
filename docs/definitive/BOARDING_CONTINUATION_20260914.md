# Chapter One boarding continuation — September 14, 2026

Current work is the existing `astra/chapter-one-interior` branch and draft PR #131, based on main. The handoff commit `7f12d04026a6e7c0052a49beed07fbcf49aca5d4` was confirmed locally, pushed without force, and verified against GitHub and Vercel. Build Check run 34802021150 succeeded; Vercel deployment A6AKRCMPaqo9JhXrbmsLkoMTPpL3 is READY for that exact SHA. GitHub reported no merge conflicts. No draft was merged or retargeted.

## Fix found during continued play

A jump near the parked fighter could land XRP Man inside its expanded collision bounds. The previous movement test rejected every small walking step that still overlapped the fighter, trapping him until another jump. The rendered failure was at x 0.274, z -23.650 after the arrival-bay fight.

Movement now permits an overlapping hero or companion to move outward along either axis while preventing deeper entry. Ordinary grounded approaches still collide with solid cover. The live regression jumped into the fighter boundary again, landed at x 0.742, z -24.220, then walked out to z -23.236 without another jump.

The arrival-bay retry previously used the room centerline inside the parked fighter. It now uses that original fighter's `Pilot_Exit`, matching first entry. Retry also clears stale vertical velocity, dodge movement, and melee animation time. An actual defeat/retry restored x 1.700, z -25.500 and allowed immediate walking with no jump.

A second rendered regression appeared on returning from the cache: the captured green bridge still enforced the hostile Shield gate (stopped at z 35.993). Capture now removes that restriction while the assault still requires Shield. Reloading the earned bridge checkpoint and walking unshielded reached z 37.048, and the terminal retained both purchases, departure readiness, all eight cleared rooms, Mr Zamn, the original fighter, and 200 credits.

## Validation

- All 64 validators passed; the boarding validator additionally drives the actual retry button and covers outward overlap escape, blocked inward motion, normal solid-cover entry, and the companion radius.
- Separate `npx tsc --noEmit` and `npm run build` passed. The existing large deferred-chunk advisory remains.
- A rendered keyboard/button run cleared the arrival bay, Security, Crew Junction, Engineering, Command, Core, bridge, and the optional cache. Engineering power, the hidden detention wall, Mr Zamn recruitment, all four boarding weapon tiers, companion shots, and the bridge capture were earned through ordinary inputs.
- The less mobile first Core attempt died. A lateral-movement retry cleared it at 97 vitals with the recruited companion and prior upgrades intact.
- The unshielded exit stopped at z 35.976; active Shield permitted z 36.797. The 520 HP bridge captain was defeated and the capture clock was sampled from 4.50 to 0.00 while the bridge changed from red to green.
- The optional cache granted 100 salvage once after the fight; after both capital purchases the balance was 200. All eight sectors were cleared through gameplay.
- Repair and shield-capacity purchases installed only on the capital ship. Departure preparation completed. The original fighter remained `player`; fighter upgrades stayed separate from the boarding weapon and Ledger Shield.
- These are desktop browser checks, not measurements of physical-phone performance or human difficulty preference. Test-controller routes were corrected around authored consoles and the fighter; those navigation adjustments are not game teleports. Reloads during local code updates preserved the earned isolated save.

## Recovery and remaining work

The starting source archive and Windows working bytes were restored and all 396 tracked-file hashes matched. Five local Blender master files were separately copied and restore-verified. Recovery files and browser evidence are private under the Desktop `CODED-131-review` directory. Neither `artifacts/` nor `artifactscontinuation-fresh-run.mjs` is part of the commit.

Claude was notified on PR #131 of the pushed handoff SHA and asked for the independent audit. His earlier two findings had already been fixed by fdba773. The app browser connection failed, so coordination used the existing PR discussion.

Keep #127 → #128 → #129 → #130 stacked and draft; eventual landing requires that order with retargeting to main. #131 is independent. Emplacement danger versus durability, GROUP_MIN_DWELL, the boss HP ladder, and boss-act hazards remain pending dedicated validation on those other branches. No production release or merge is authorized.
