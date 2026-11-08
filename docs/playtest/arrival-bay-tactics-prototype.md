# Arrival Bay tactics prototype — one-room review

Direct route: `/?review=tactics` (isolated `test:tactics` save slot).

## Scope and canon
- The 2D shooter, normal campaign boot, eight-room boarding scene, rewards, warship ownership, and normal flight remain unchanged.
- A **separate enlarged 28×30m Arrival Bay prototype** hosts one red-lit security door and **one Level 1 door guard**.
- The existing in-game XRPMan GLB is retained **for this tactics prototype only**. The new corrected Meshy XRPMan remains a separate rig/animation conversion task. No new enemy GLB is claimed; door guard is obvious graybox modeled placeholder pending Meshy asset.
- Only the prototype's local progression exists: each actor has independent level, XP, HP and damage. The guard grants +60 test XP to level XRPMan from 1 to 2. No progress is awarded to the actual campaign.
- No character is allowed to sprint around the small room. Tapping the floor or keyboard WASD walks the character; walking within 7.5 metres of the door guard engages combat. The "ENGAGE GUARD" button offers a review shortcut.
- Tactical mode: 2 AP per hero turn, MOVE (one tile within 6m) / SHOOT / TAKE COVER / END TURN. Guard responds once per turn, and cover mitigates incoming damage.
- Touch: pinch zoom with two fingers; mouse wheel on desktop. Camera framing remains third-person/isometric and tracks the hero.
- Visual direction: dark futuristic hangar, red hostile door, neon-green tactical floor grid, cover crates, dual HP cards, XP/levels, action bar and laser-hit effects.

## Testing
1. Load the PR preview `/?review=tactics`; confirm **ARRIVAL BAY** and single guard.
2. Tap empty floor or use WASD to walk. Verify combat activates near the guard or via ENGAGE button.
3. Fire at guard with SHOOT (2 AP per turn). After 2 shots, enemy retaliation should occur; the third hit should defeat the guard.
4. Verify display of earned +60 XP, LV 2, 25 damage and no campaign rewards.
5. Retry battle. Check level and HP reset to Level 1; reload and confirm isolated session.
6. Touch test: pinch to change view, no unwanted walking, status/action buttons remain reachable at portrait and landscape phone sizes.
7. Load `/?review=boarding` and the normal campaign root separately; confirm unchanged real-time mode.

## Limitations
This is a **one-room graybox tactics prototype**, not the final ship interior, fully featured strategy game, or replacement XRPMan/enemy art. Cover and enemy AI are deliberately simple. Guard geometry, expansion into the other rooms, multiplayer, permanent character progression, upgrades/skill trees and new Meshy models are future PRs after owner feedback. Only this isolated test route is authorized here.

Build gate: npm ci; npm test; npm run build.
No main merge or production release without XRPMan approval.
