# CODED: XRP — Phase 2B Classified Asset Ledger

**Status:** docs-only shared source of truth for asset KEEP / MAYBE / DROP decisions.
No images, archives, or raw assets are committed by this PR.
**Inputs:** GPT's `coded_image_inventory` (504 raw files / 478 unique / ~492 MB) + the curated
`coded_asset_crops_from_reference/` set. Per-file decisions live in
[`phase-2b-classified-asset-ledger.csv`](./phase-2b-classified-asset-ledger.csv).

> First-pass classification by filename + folder heuristics. The 63 curated crops are
> authoritative (GPT named them by role); the ship/enemy split and final KEEP picks among
> variants still want a human/GPT eye.

---

## Headline conclusion (preserve this)

- **KEEP — 63 curated gameplay crops.** Game-sized (100–180 px, ~20–70 KB each), names map 1:1 to
  the PR #16 manifest keys.
- **Committed gameplay tier ≈ 1.53 MB total.** The deploy repo only ever needs this small set.
- **MAYBE — 410 files → private master archive / future scope** (UI, menus, world-builder, FX
  variants, extra ship/enemy concepts, raw generations). Not committed now.
- **DROP — 31 files** — screenshots, contact sheets, scratch/reference only.

| Decision | Count | Destination |
|---|---:|---|
| KEEP | 63 | game repo (`public/assets/`), optimized to WebP |
| MAYBE | 410 | `coded-xrp-assets-master-private` (pick later) |
| DROP | 31 | archive only / discard |

## Category breakdown

| Category | Count | Tier |
|---|---:|---|
| menus/UI | 150 | MAYBE — future UI & polls |
| **gameplay-crop** | **63** | **KEEP** |
| fx-variant | 60 | MAYBE — spritesheet candidates |
| raw-source | 41 | MAYBE — raw generations |
| ship/enemy-variant | 37 | MAYBE — beyond the 10+10 roster |
| environment-variant | 36 | MAYBE |
| uncategorized | 35 | MAYBE — needs eyes |
| reference/contact | 31 | DROP |
| world-builder/env | 24 | MAYBE — future world builder |
| pickup-variant | 16 | MAYBE |
| ground/turret | 11 | MAYBE |

---

## Batch 0 — current live slots (DEFERRED)

**Do not start until PR #18 (Phase A data-driven content foundation) is merged**, because Batch 0
swaps real art onto the data layer that PR #18 introduces.

When unblocked, Batch 0 is a **separate asset PR** (GPT lane) targeting only:

- `ships.player`
- `enemies.regulator_drone`
- `projectiles.bb_shot`
- `vfx.burst_ring`
- `special.clarity_pulse`

**Batch 0 rules:** optimized WebP/PNG only · no raw zips · no archive dumps · no gameplay logic ·
no new systems · manifest remains source of truth · asset PR kept separate from logic PR.

Subsequent gameplay batches (full ship/enemy/weapon/pickup/FX/env/ground/boss rosters) ship per the
master-plan phases, each as its own asset PR.

---

## Storage model (documented, NOT implemented in this repo)

Three tiers — only the first lives in this repository:

1. **Game repo — `coded-xrp-hunt-for-clarity` (this repo)**
   - Only optimized assets actually referenced by the manifest.
   - No raw archive, no duplicate variants, no unused bulk images.

2. **Private master — `coded-xrp-assets-master-private` (to be created separately)**
   - Raw / full-size generations, duplicate variants, source/reference material.
   - Future UI / menu / polls / world-builder art.
   - **Not loaded directly by the browser game.**

3. **Optional later — public CDN / `coded-xrp-assets-web`**
   - Optimized assets only; manifest may point to public URLs.
   - Never expose private-repo credentials in the browser.

**Runtime rule:** a browser game cannot load from a *private* repo without exposing credentials.
Runtime assets must live in the game repo or a public/CDN-safe host.

---

## Ledger CSV columns

`filename, width, height, size_mb, decision, storage_tier, category, proposed_manifest_key, notes`

See `phase-2b-classified-asset-ledger.csv` for all 504 rows.
