# Phase L — Runtime Boss Art

## Scope

- Adds one optimized top-down WebP sprite for each live boss manifest key.
- Replaces procedural silhouettes at runtime without changing boss data, balance, collision, attacks, or campaign flow.
- Keeps generated masters outside the deploy repository; only optimized runtime assets are committed.

## Runtime Slots

| Manifest key | Boss | Runtime image |
| --- | --- | --- |
| `bosses.gary_fog_phase1` | Gary Fog | `public/assets/bosses/gary_fog_phase1.webp` |
| `bosses.regulatory_behemoth_phase2` | Regulatory Behemoth | `public/assets/bosses/regulatory_behemoth_phase2.webp` |
| `bosses.clarity_destroyer_phase3` | Clarity Destroyer | `public/assets/bosses/clarity_destroyer_phase3.webp` |
| `bosses.final_clarity` | Final Clarity | `public/assets/bosses/final_clarity.webp` |

## Asset Rules

- Transparent alpha, no baked canvas, captions, logos, or unused files.
- Two-times runtime draw resolution for crisp high-density displays.
- Combined deploy weight is approximately 116 KB.
- Manifest remains the source of truth.

## Verification

- Confirm all four files retain alpha and match the intended draw aspect ratios.
- Run `npm ci`, `npm test`, and `npm run build`.
- Manually inspect each encounter at desktop and narrow mobile widths.
