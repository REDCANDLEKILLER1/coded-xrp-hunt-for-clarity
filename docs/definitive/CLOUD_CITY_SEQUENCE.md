# Earth clouds and city route — 2026-10-07

Baseline main: 8b60fc797c85c43d73c4c56f268b5958cd2bf10c.

Twenty separate original backgrounds, ten cloud_path_01–10 and ten city_path_01–10, all 1024×1536. Built-in image generation; early cloud variants were corrected to hide ground entirely. Final PNG masters preserved outside runtime assets in cloud-city-masters-v1. Runtime WebP files total 3391554 bytes, registered for flight with byte counts and SHA256.

After the opening space-section boss and seven-second Earth-entry animation, a 40-second steerable cloud approach passes through all ten cloud tiles. Pause/menu suspend it. City combat and the banked boss upgrade start when the approach ends. Threats do not spawn underneath concealed ground. Reload still starts a fresh test run; a retry from the banked city checkpoint begins in the city rather than replaying the defeated boss.

The descent never loops back to high altitude. The city route continues ten distinct districts and loops city10→city01; shared by Ledger City and the Regulatory Outpost stage. Normalized tile progress prevents phone rotation from switching route tiles. Runtime navy edge fades soften seams. The outgoing cloud10 tile remains until it scrolls off the bottom at city arrival. Missing images retain navy/old illustrated fallback. Legacy arcade scene remains unchanged.

Art prompt set: strict vertical aerial camera, midnight navy/black, restrained #00FF00 lights, soft upper-left moonlight, low-contrast clear central lane, quiet navy transition edges, no text/HUD/ships/enemies. Clouds: high cirrus → thick cloud tops → breaking clouds → distant city → clear city. City: arrival → downtown edge → civic blocks → canals → industry → dense center → administration → older roofs → outskirts → return downtown. No baked interactive hazards.

Verification: full npm test and npm run build; native Canvas renders of actual Game2A cloud01/cloud06/cloud10/city02 inspected; runtime portrait and landscape simulations confirm pause, steering, cloud completion before city combat, banked reward, clean restart, exact rendered handoff, and route coverage/order. Physical-phone frame-rate/playtesting remains owner verification. Existing bundle-size warning remains.

Recovery: before-cloud-city.bundle was restored into cloud-city-backup-check. Revert this scoped commit to restore the ten-space-tile live baseline. No deployment/security/wallet configuration changed.

## Comms replay correction

Owner report: opening COMMS during cloud descent left STONE on page 1 / 8 with blank text; Continue and Skip did nothing. Both transit branches returned before EarthCommsRuntime.update, so Dialogue.age stayed zero and its .18-second fresh-input guard never armed.

Transit now updates Comms before its simulation branch and holds flight while a replay is active. Automatic act/restoration conversations are suppressed during transit, leaving the city briefing at its intended combat boundary. Replay still grants nothing and writes no save receipts.

The boss-tempo regression drives the real EarthCommsRuntime, CommsPanel click handlers and Dialogue through Game2A.frame in portrait and landscape, during cloud descent and Earth entry. It verifies text reveal, Continue advancing page 2 / 8, Skip dismissal, Continue-only completion, frozen/resumed travel and steering, and no early city briefing or replay save writes. Full npm test and production build are the publication gates. Physical phone interaction remains owner verification. Recovery: the unchanged route/assets are in production baseline 010881a; before-cloud-comms.bundle was restore-tested outside the repository.
