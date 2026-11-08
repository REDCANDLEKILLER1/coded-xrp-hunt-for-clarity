# Direct 3D boarding playtest

**Preview-only convenience route:** `/boarding-preview.html`

This standalone static entry immediately redirects within the same deployment to
`/?review=boarding`, the existing isolated Three.js boarding review route in
`src/main.ts`. It enters at the **hangar**, the first playable room after
boarding the disabled Regulatory Warship. No 2D mission replay is required.

Use `/?review=boarding` directly if the static shortcut is unavailable on the host.

## Boundaries

- Uses `reviewSaveSlot`'s `test:boarding` save, not the production campaign slot.
- `startFreshTestRun` starts the test review from a fresh state on load.
- Existing `MeshRuntime.showBoarding` and `BoardingQuest.begin` create the
  regular first-room checkpoint. No quest flags, ownership, inventory,
  rewards, room clears or character abilities are granted by the shortcut.
- The 3D scene itself still uses the **currently committed** XRPMan and Mr Zamn
  GLBs. The new Meshy character exports and replacement Regulatory Warship
  are **not part of this PR**.
- On-site graphics availability and physical-phone performance require a
  separate playtest. No gameplay rendering has been claimed merely because a
  static entry page exists.
- This PR does not modify onboarding, runtime, flight, save logic, manifest,
  ship models, Vercel configuration, or production settings.

## Review steps

1. Open `/boarding-preview.html` on the PR preview host.
2. Confirm the address becomes `/?review=boarding`.
3. Confirm 3D boarding loads into the **hangar** with the existing review pause
   and RESUME action, without any 2D boss fight.
4. Walk/fight in the first room; verify movement, shooting and HUD.
5. Reload; confirm the test run resets and the normal campaign save is untouched.
6. Load the host's root URL separately; confirm ordinary campaign boot is unchanged.

**Release gate:** This is a draft direct-entry convenience PR only; do not merge
or deploy it to production without owner approval and normal CI.
