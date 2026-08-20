# CODED Audio / SFX Lane

**Updated:** 2026-08-19

Plan audio globally, add runtime audio just-in-time with each gameplay phase.

## Level 1 expected SFX palette

- player weapon fire by upgrade tier
- enemy blaster fire
- turret fire
- mine arm / proximity warning
- light enemy explosion
- heavy explosion
- boss impact / armor hit
- shield hit
- Fog Breaker charge / activation
- pickup
- checkpoint secured
- warning / alarm
- Gary Fog attack telegraphs
- Regulatory Warship cannon / subsystem damage
- hangar door / breach opening
- fighter engine / direct boarding fly-in
- XRPMan footsteps
- XRPMan Liquidity Blast
- Ledger Shield
- interior terminal / doors
- Ledger Defense Core attack / shutdown
- Earth defended / capital ship captured stinger

## Pipeline rules

- Prefer commercially usable, clearly licensed sources and/or original layered processing.
- Track source/license metadata for every externally sourced clip.
- Keep master WAV/reference libraries outside the deploy repo.
- Commit only optimized runtime files actually referenced by the audio manifest / registry.
- No giant audio library dumps or unused clips in runtime.
- Layer/trim/process stock sources so CODED has a coherent sonic identity.
- Do not add audio that masks gameplay telegraphs or overwhelms mobile speakers.

## Timing

Do not block L1-A/L1-B/L1-C on audio. Add SFX when the related gameplay behavior is stable enough to specify duration, transient strength, loop behavior, and mix priority.
