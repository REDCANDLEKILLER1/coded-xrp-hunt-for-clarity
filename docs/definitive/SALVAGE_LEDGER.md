# Preserved contributions

Starting main: 6743368ad7a2a465c660eceeadc0ce380818dcc3. Candidate heads are preserved in the verified savepoint. KEEP means code selected for this branch, not completion of the definitive campaign. All selected commits retain original authorship and a cherry-pick source reference.

| PR | Decision | Contribution and adaptation |
| --- | --- | --- |
| 108 | KEEP, adapt transition later | Intermediate Behemoth/Destroyer acts, guardian stage inheritance, checkpoint advancement, and capture checks. Its old direct-to-cockpit ending will be replaced by the approved actual boarding flow. |
| 111 | KEEP | Portrait flight reach and drag-from-button behavior. Multi-pointer ownership and blur/cancel behavior still need the definitive input pass. |
| 107 | KEEP | Banking multiple maxed ranks pays for every rank. |
| 113 | KEEP, adapt weapons later | Center coverage and useful barrel additions. The old five-gun progression is not the approved five-family/four-stage progression. |
| 114 | KEEP | Thin moving faction-colored shields and hull readability. Updated its rendering test to launch an actual timed escort screen. |
| 117 | ADAPT | Preserve run-based pressure independent of pickups, actual doctrine projectile behavior, finite missile tracking, and behavioral validators. The four current doctrines do not yet meet the definitive five-enemy signatures. |
| 118 | ADAPT | Preserve bounded escort screen and timeout tests. Corrected campaign escorts not moving, ambient pressure erasing screen state, repeat launch replenishing a shortened screen, and rapid full clear skipping cooldown. Added combined entry-point regression checks. |
| 119 | ADAPT, not yet applied | Reviewed weighted hull sizes/health/speed. Its initial slot test and unconditional heavy wing can exceed the budget, and authored mission spawns require the same budget. Replace temporary outline Whale treatment with distinct production art. |
| 115 | SUPERSEDED | PR124 is the active combat/art specification. Preserve this older plan as history. |
| 116 | PENDING selective audit | Manifest-consumer validator and optimized turret derivative are candidates for the typed, scene-aware registry. Do not import unused art. |
| 120 | SUPERSEDED ladder; preserve 117 base | Nine linear rungs are superseded by five families with four stages each. Inspect individual useful weapon behavior while implementing that system. |
| 110 | PENDING selective audit | Checkpoint/pause behavior is relevant. The definitive save must have its own versioned namespace; do not copy an old full-world snapshot wholesale. |
| 109 | ADAPT later | Main already includes later flight work. Preserve verified drag feel and loop behavior when implementing a single quaternion-based mesh flight adapter. Tilt remains disabled. |
| 122 | ADAPT later | Four-muzzle geometry, scale reasoning, collision tests and asset discipline are useful. Its projected atlas and alternating-pair cadence are superseded by a loaded mesh and four bolts per volley. Keep the original PR intact. |
| 103 / 105 / 106 | PENDING selective audit | Competing ground/doctrine experiments are preserved. Compare against PR124's authored ground structures before selecting any code. |

## Integration verification

The first combined suite exposed that the readability fixture fabricated an escort flag without starting its screen clock. It now uses the real launcher. New boss checks drive the campaign update path and assert that pressure/relaunch beats cannot cancel or replenish screen state. Focused checks pass; all gates must be rerun after subsequent edits.

The recorded simulated boss times are headless tempo measurements with player invulnerability, not human playthrough evidence. They do not satisfy the connected-play or phone gates.
