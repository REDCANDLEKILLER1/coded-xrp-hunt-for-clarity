# Moving opening space section and Earth entry — October 7, 2026

Owner clarified the ending belongs to the opening space section, not the last boss of the whole level. The opening uses the existing moving deep-space lane illustration with three procedural star parallax layers. No Earth plate is displayed during orbital approach, the fog belt or the Regulatory Behemoth fight. Orbital travel advances through the launch reveal and normal flight; intentional game/loadout pauses still freeze it. Ground backgrounds retain their existing scrolling tile behavior.

The Regulatory Behemoth defeat banks the Ledger City checkpoint and starts a seven-second entry cinematic. Threats and stale controls are cleared. The new transparent Earth globe fades in and grows ahead while space keeps scrolling. The selected fighter flies forward, shrinks and disappears. A short fade leads into Ledger City; the boss upgrade reward is offered after the cinematic. Later bosses and final capital-ship capture do not trigger this sequence. A retry from the banked checkpoint resumes the next section without replaying the defeated boss.

## Generated asset

Built-in image generation was used for `public/assets/backgrounds/earth_entry_globe_v1.webp`. It is 1024×1024 with alpha, 324,208 bytes, declared in the flight manifest with its byte count and SHA-256. The original generated PNG remains outside the public repository. Existing orbital artwork is retained as a missing-image fallback; the generated globe is the normal cinematic asset.

Prompt: “Use case: stylized-concept. Asset type: production 2D space-game planet sprite, square composition. Create a single complete round Earth viewed from space, realistic blue oceans, recognizable continents, textured white cloud systems, thin luminous neon green #00FF00 atmospheric rim, subtle green luminous technology-network points on land matching CODED: XRP The Hunt for Clarity. Sunlight from upper left, strong dimensional sphere shading but surface visible. Entire planet and soft atmosphere fully inside frame, centered, circle diameter 80% of frame, ample transparent padding all around. Genuine transparent alpha background. No stars, no surrounding space painted in, no ships, no typography, no UI, no symbols, no watermark. This cutout will grow ahead of a spacecraft during Earth-entry animation.”

## Verification

The actual boss-tempo runtime harness checks launch and combat scrolling, no early Earth image, both viewport shapes, Behemoth-only entry, duplicate-final-hit safety, input capture, pause, moving descent, fighter shrink/disappearance, checkpoint and reward preservation, safe ground continuation, fade completion under upgrade menus, later-boss exclusion and restart cleanup. Actual Game2A drawing was rendered through a native Canvas implementation at space, reveal, approach and disappearance frames and visually inspected. This is headless renderer evidence, not a phone-browser playtest.

All 68 npm test scripts, TypeScript/Vite build, asset-integrity, asset-consumer and diff whitespace checks pass. The generated asset adds one 324 KB flight download and approximately 4 MB decoded image memory. No dependency, wallet, lockfile, workflow or Vercel configuration changes.

Rollback baseline: ee3130bd7080bd3cf6711b5e25eb26cf00770a8b. Revert this scoped change to restore the prior static orbital plate and immediate space-to-city transition.
