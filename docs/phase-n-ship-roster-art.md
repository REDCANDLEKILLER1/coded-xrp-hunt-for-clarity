# Phase N — Ship Roster Art

## Scope

- Gives XRPL Striker and Ledger Warden dedicated runtime sprites.
- Keeps the existing Clarity Interceptor asset unchanged.
- Updates only the two live ship sprite mappings required to consume the new art.

## Handoff Processing

The two full-size player candidates from the audited Opus handoff were processed outside the repository. Their black backgrounds were edge-keyed, then each craft was trimmed, centered, resized to two-times its runtime draw size, and optimized as transparent WebP.

The two added runtime files total less than 7 KB.

## Verification

- Confirm all three ship-select cards render distinct silhouettes.
- Confirm selected draw size, hitbox, speed, HP, and fire cadence remain unchanged.
- Run the clean deployment build and verify desktop/mobile selection and replay.
