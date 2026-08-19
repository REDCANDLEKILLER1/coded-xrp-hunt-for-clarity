# Phase J — Campaign Completion and Local Records

## Scope

- Adds a four-act HUD indicator tied to completed boss gates.
- Converts the Final Clarity defeat into a short clear sequence and dedicated victory screen.
- Adds tap-to-replay from both failure and victory without changing the selected ship.
- Stores high score, highest wave, and campaign victory count in versioned browser-local storage.
- Treats persistence as optional: malformed records, blocked storage, private browsing, and quota errors cannot stop play.

## Persistence Contract

`CampaignProgress` is a small pure module that sanitizes untrusted stored JSON and records only monotonic best values. The runtime key is `coded-xrp-campaign-progress-v1`; no account, wallet, network, or secret data is read or written.

## Verification

- `npm test` now validates malformed progress parsing, integer sanitization, monotonic records, and victory increments alongside registry validation.
- Production build must pass TypeScript and Vite checks.
- Manual pass: lose a run, replay, complete Final Clarity, confirm the clear sequence reaches the victory screen, then reload and verify best-run values remain visible.
