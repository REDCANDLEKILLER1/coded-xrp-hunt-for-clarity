# Asset Pipeline

CODED uses `/public/assets/manifest.json` as the source of truth for web-ready assets.

## Rules

- Do not commit huge raw archives or the 782 MB backup zip.
- Keep raw art archives outside GitHub or in GitHub Releases later.
- Commit only optimized web assets, manifests, and docs.
- Every manifest category must tolerate missing files.
- The engine falls back to procedural canvas drawing when an image is unavailable.

## Drop-in folders

```text
/public/assets/ships
/public/assets/enemies
/public/assets/bosses
/public/assets/weapons
/public/assets/projectiles
/public/assets/vfx
/public/assets/ui
/public/assets/base
/public/assets/campaign
/public/assets/hazards
/public/assets/objectives
/public/assets/special
```

## Manifest example

```json
{
  "ships": {
    "player": "/assets/ships/player.png"
  }
}
```
