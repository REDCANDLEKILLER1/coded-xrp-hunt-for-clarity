import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const game=readFileSync('src/game/core/Game2A.ts','utf8');
const manifest=JSON.parse(readFileSync('public/assets/manifest.json','utf8'));
const roster=readFileSync('src/game/content/registry.ts','utf8');
const landing=readFileSync('src/game/definitive/LandingPlan.ts','utf8');
const brief=readFileSync('docs/asset-briefs/clarity-interceptor-meshy-hangar.md','utf8');

assert.ok(manifest.ships.player.src==='/assets/ships/player.webp','canonical ship sprite');
assert.match(manifest.ships.player.notes,/player_clarity_interceptor/,'canonical art identity');
assert.match(roster,/player:\s*\{\s*key:\s*'player',\s*label:\s*'CLARITY INTERCEPTOR'/,'starter ship stays player');
assert.match(landing,/FIGHTER_MODELS\s*=\s*\{player:'fighter_player'/,'3D fallback remains player');
assert.match(game,/const DEFAULT_SHIP\s*=\s*SHIPS\.player/,'starter default');
assert.match(game,/private selectedShipKey\s*=\s*DEFAULT_SHIP\.key/,'new game starts with default');
assert.ok(!/type Mode\s*=.*\b'select'/.test(game),'ship selection mode must not recur');
assert.ok(!game.includes('SELECT YOUR SHIP'),'no starter ship picker');
assert.match(game,/if \(this\.mode === 'title'\) \{ this\.selectedShipKey = DEFAULT_SHIP\.key; this\.reset\(\); return; \}/,'title START launches canonical fighter');
assert.match(brief,/01a1c156-cee6-76eb-b446-c96e4a328394/,'Meshy production task checkpoint recorded');
// Other ship archetypes are deliberately retained for future compatibility.
assert.ok(manifest.ships.xrpl_striker&&manifest.ships.ledger_warden,'do not destructively delete older asset refs');
console.log('single-starter: Clarity Interceptor is sole public starter; legacy art and Meshy task preserved');
