# Foundation verification — 2026-09-06

This report covers the current foundation, not the connected campaign deliverable.

- Ordinary `npm ci`: pass after recording the missing, exact-version optional Windows Rollup component in the project lockfile.
- `npm test`: all 39 validator scripts pass, including preserved controls/content/flight tests and new save, scene and GLB checks.
- `npm run build`: pass. Initial application JS 250.14 kB (73.50 kB gzip); lazily requested mesh-review chunk approximately 639.25 kB (163.54 kB gzip). Vite reports its advisory 500 kB chunk warning for this deferred chunk. No threshold was raised to hide it.
- Save behavior: legacy source bytes unchanged; section slots isolated; atomic reward/ownership/recruit/quest/checkpoint updates; reload deduplication; insufficient funds and repeated purchases; quota failure retry; conflicting tabs; malformed/future record protection; actual existing 2D load/save adapter.
- Scene behavior: only one scene owns input, loading pauses simulation, stale asynchronous loads dispose, failed loads restore the prior scene, closing is idempotent. Full legacy-to-new scene transitions remain to be implemented.
- GLB: 396,960 bytes, SHA in the authoritative asset manifest. Real GLTFLoader parses 5,156 triangles in six surfaces, nine uniquely named attachments and four distinct finite muzzle origins. Tests cover truncated download, cancelled parse and geometry disposal. Blender independently re-imported the derivative and checked each attachment transform.
- Escort regression mutations: frozen campaign escorts; ambient pressure cancelling cooldown; full clear skipping cooldown; repeat launch replenishing a partial screen. Each mutation failed the specific behavioral check; original source bytes were restored.
- Browser visual checks: model renders, no recorded page errors or Vite overlay, portrait 390x844 and landscape 844x390. Fixed portrait cropping and a covered return button. Clicked muzzle toggle, captured lighting and return to map. These are desktop viewport checks, not physical phone tests.
- Review scene cost: seven draw calls and 5,156 triangles for model plus grid; with four muzzle markers, eleven draw calls and 5,716 triangles. These are a static review scene, not combat performance.

Remaining evidence: normal Earth-to-Mars play, real hero/boarding/mesh combat, transitions and checkpoint recovery in play, asset download/decode totals by scene, p50/p95/p99 combat frame times and ten-minute soak, real phone handling, all later destinations. Existing npm audit output still reports four advisories in the inherited toolchain; no unrelated package upgrade was performed in this foundation pass.
