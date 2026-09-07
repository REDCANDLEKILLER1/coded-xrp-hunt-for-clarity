# Captured-hull flight checkpoint

Continuing production under PR124; not a completed campaign or final art approval.

The captured Warship flies as its textured v03-derived mesh. One scene-root rotation converts glTF +Z bow to engine -Z forward; metres remain 1:1. Precise loaded v03 bounds are 119.997 m long, 81.483 m wide and 25.000 m high. Earlier 120×56×27 dimensions belong to the first greybox. Loaded nodes supply cameras, engines and all four muzzle origins.

Each held primary volley emits four volumetric green bolts and release/cancellation stops new fire. Convergence stays on the loaded gun-deck plane. A centre-of-hull target clipped the side-gun paths; the corrected plane and 400 m minimum pass 1,200 paths at 75 orientations, including the visible 0.18 m bolt radius. The rangefinder adjusts depth only; aim direction remains player-controlled. A separate marker predicts lead. Quaternion flight retains drag travel/turn easing and independent weapon-pointer ownership.

Collision sweeps the travelled segment against actual hull triangles after a broad bound. Radius uses five offset rays: this is a sampled swept-volume approximation, not exact capsule collision. Small-enemy hit tolerance is wider than the visible bolt core. Shields have fore/aft banks and delayed regeneration; hull loss exposes a saved-patrol retry. Further collision/counterplay refinement remains.

Five textured enemy meshes and Earth/Mars spheres are actual scene consumers. Stable approach bearings and attack/extension windows make targets catchable. Rug armor rewards flanking; the distinct broad Whale carries modeled, shootable missiles. Four patrols lead to a portal 24 game-scaled kilometres away. Portal entry preserves pose and atomically records Mars. Surface-source credits are in SPACE_ASSET_CREDITS.md; private source imagery and masters remain outside the repository.

Eight space models total 6,017,868 bytes. Seven new models passed real Blender export/re-import checks for nodes, bounds, triangles and embedded maps. The capital retains nine nodes and 19,250 triangles. Enemy triangle counts: 5,480 / 4,812 / 4,324 / 4,500 / 8,712. Each planet: 9,024 triangles.

Ordinary-control portrait play completed departure, four patrols and Mars arrival in 188.4 simulation seconds: 149 volleys, 596 bolts, 78 enemy hits, eight incoming hits and 100 hull remaining. No browser errors. Periodic samples were below 41,000 submitted triangles and 26 calls, not a frame-time distribution. This used the explicit isolated space fixture, with no console game-state writes. Earlier play exposed uncatchable formation rotation and overly frequent attacks; both were corrected before the successful run.

After that flight, normal 2D aperture entry was connected to selected-fighter recovery, boarding, bridge and departure. Reload selects the saved chapter. The 2D loop/input and aperture overlay now relinquish ownership during 3D play. Portal dialogue uses fresh-input two-stage reveal/advance and skip, banked before arrival. Mars is inserted before Fog Moon without removing old keys or unlocks. Capital firing has its own synthesized sound. These final connection/dialogue changes need a new full browser journey replay.

All 47 validators and the final TypeScript/Vite build pass. Native CDP touch tests pass at390×844 and844×390: independent steering/fire, release in either order and cancellation. Initial JS is257.56KB/75.84gzip; lazy3D736.14KB/192.40gzip. The existing lazy-chunk advisory remains. Dependencies are unchanged from the earlier successful npm ci. Full Earth-to-Mars play, final boarding touch/performance, a ten-minute soak, physical-phone testing, realistic art refinement and the later campaign remain. Nothing is merged or released.
