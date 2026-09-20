# Model provenance

Runtime models cannot be rebuilt from anything in this repository. The Blender
masters are held outside it on purpose, so no check here can re-bake a GLB and
diff the result. That is precisely why model drift is invisible: a hand-finished
mesh committed over a script-built one passes every existing check, including
the roundtrip validators, which only prove a model survives import and export.

So provenance is **pinned** rather than recomputed. Three stores must agree, and
any one of them moving alone fails `npm test`:

| store | file | holds |
| --- | --- | --- |
| the file | `public/assets/models/*.glb` | what is actually committed |
| the manifest | `public/assets/manifest.json` | `bytes`, `sha256` (shipped to the client) |
| the baseline | `docs/definitive/model-provenance.json` | structure and anchors (development only) |

`docs/definitive/ASSET_LEDGER.json` is prose documentation, not a source of
truth, but it may not *contradict* the manifest — that is how a rebuild gets
forgotten.

## Declaring a re-bake

A model changing is normal. A model changing **silently** is the defect. After a
legitimate re-bake:

```bash
node scripts/record-model-provenance.mjs          # rewrite the baseline
node scripts/record-model-provenance.mjs --check  # print drift, write nothing
npm test
```

The recorder prints every fact that moved, and the baseline diff is what a
reviewer reads — `corn.triangles: 43681 -> 72549` is a legible claim in a way
that a changed binary blob is not. Prose fields already in the baseline
(`note`) are preserved, so re-recording never discards human commentary.

Never re-record simply to quiet a red gate. If the counts moved and nobody
meant them to, that is the finding.

## Why anchors

`anchors` is the assertion that earns its keep. The runtime resolves model nodes
by name in 53 places, and `MarsExcavationScene` throws outright when one is
missing:

```ts
for(const name of ['Core_Target','Core_Containment','Pylon_Left', ...])
  if(!this.boss.getObjectByName(name))throw Error('Missing Warden node: '+name);
```

A re-bake that renames `Muzzle_L` or drops `Gate_Frame` is a crash on device
with no failing test. Pinned anchors make it a red gate instead. Skin joints are
excluded deliberately — a rigged character carries 163 of them and they are
skeleton, not contract.

## Known limitation

This detects **undeclared** drift, not **bad** drift. Someone who edits a model
and re-records the baseline in the same commit gets a green gate; what they do
not get is a silent one — the change is legible in the diff. Verifying a model
against its master still requires the master, which lives outside this
repository by policy.

## Recorded 2026-09-20

`corn.glb` and `boo.glb` were rebuilt in `cd08052` (2026-09-08), which updated
the manifest and left `ASSET_LEDGER.json` describing the models they replaced.
Measured, both are legitimate upgrade passes with animation names preserved:

| model | bytes | triangles | images |
| --- | --- | --- | --- |
| corn | 4,724,576 → 5,197,356 | 43,681 → 72,549 | 6 → 6 |
| boo | 415,752 → 3,318,968 | 9,064 → 40,136 | 1 → 3 |

The ledger entries were corrected to the committed models. The drift had been on
`main` for eleven days.
