# Opening space route — 2026-10-07

Ten original generated 1024×1536 backgrounds, space_path_01 through space_path_10, replace the repeating opening corridor. Quiet space → blue dust → loose mixed-size asteroid groups → dense field → thinning field → quiet space. Black, faint blue, restrained #00FF00, dark central lane, no planets/ships/HUD/text. Separate built-in image-generation calls; original PNG masters preserved outside the runtime assets.

Runtime WebP copies are registered with byte counts and SHA256, flight scene only. Their order follows camera travel, never mirrors, and wraps 10→01. Runtime gradients fade the outer 12% into a common black seam; moving parallax stars cross those seams. Missing tiles use the stars/black fallback, and complete failure retains the former backdrop. No raster edge pixels were edited.

Foreground orbital meteor props now follow orbital travel in five fragments of varied size rather than a stationary single plate. Ground props remain unchanged. Pause/loadout freeze motion as before. The section-ending Regulatory Behemoth → Earth-entry → Ledger City transition remains intact.

Validation: ordered-loop and viewport coverage in portrait/landscape added to boss-tempo validator; actual Game2A Canvas rendered opening, dust, dense field, complete loop and Earth-entry frames. Full regression suite and build required before push. Physical-phone playtesting remains owner testing.

Rollback baseline: cfde0c616a42e2ca7f4cbf3726d52c633859c97b. Backup bundle before-space-sequence.bundle was restored into sequence-backup-check. Revert this scoped commit to restore the former repeating space backdrop.
