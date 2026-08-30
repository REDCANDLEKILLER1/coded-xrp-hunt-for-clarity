// The gun, and the level-up choice.
//
// Two playtest reports, one root cause each.
//
// "It's shooting too many bullets and it looks strange -- it's trying to shoot
// four and then an extra." Barrels were appended one at a time, alternating
// sides, so a four-beam gun with one barrel fired -13, -5, 5, 13, -22: four
// symmetric beams and a single extra hanging off the left. The same loop
// stopped at the volley cap mid-pair, so a quad gun's third barrel bought
// nothing at all.
//
// "There needs to be choices every time unless it's upgraded all the way to
// Max and then it says Max." The offer drew only from tracks that still had
// something to give, so the card count shrank as the run went on -- and once
// everything was full the rank was converted to score in silence and the
// player never saw a level-up at all.

import { readFileSync } from 'node:fs';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const game = readFileSync('src/game/core/Game2A.ts', 'utf8');
const registry = readFileSync('src/game/content/registry.ts', 'utf8');

const num = (name, src = game) => Number(new RegExp(`const ${name} = ([\\d.]+);`).exec(src)?.[1]);
const MAX_VOLLEY = num('MAX_VOLLEY');
const MAX_BARRELS = num('MAX_BARRELS');

// ---- the gun stays symmetric, whatever it is holding --------------------
//
// Re-implemented from the source's own rule so the shape is checked, not the
// text. Every weapon in the registry, at every barrel count.
const weapons = [...registry.matchAll(/label: '([A-Z\- ]+)',[\s\S]*?shots: (\[[\s\S]*?\]),/g)]
  .map(([, label, shots]) => ({
    label,
    offsets: [...shots.matchAll(/offsetX: (-?\d+)/g)].map((m) => Number(m[1])),
  }))
  .filter((weapon) => weapon.offsets.length > 0);

check(weapons.length >= 4, `expected the weapon ladder, parsed ${weapons.length}`);

for (const weapon of weapons) {
  const widest = Math.max(...weapon.offsets.map(Math.abs), 0);
  for (let barrels = 0; barrels <= MAX_BARRELS; barrels += 1) {
    const shots = [...weapon.offsets];
    for (let pair = 1; pair <= barrels; pair += 1) {
      if (shots.length + 2 > MAX_VOLLEY) break;
      const offset = widest + 9 * pair;
      shots.push(-offset, offset);
    }
    const sorted = [...shots].sort((a, b) => a - b);
    const symmetric = sorted.every((value, i) => Math.abs(value + sorted[sorted.length - 1 - i]) < 1e-9);
    check(symmetric, `${weapon.label} with ${barrels} barrel(s) fires asymmetrically: ${sorted.join(', ')}`);
    check(shots.length <= MAX_VOLLEY, `${weapon.label} x${barrels} exceeds the volley cap`);
  }
}

// The cap has to be odd, or an odd-base gun cannot take its last barrel pair.
check(MAX_VOLLEY % 2 === 1, `MAX_VOLLEY is ${MAX_VOLLEY}; an even cap wastes a barrel on odd-base guns`);

// And the source must actually add in pairs, not one at a time.
const volley = game.split('private currentVolley(')[1]?.split('\n  }\n')[0] ?? '';
check(volley.length > 0, 'currentVolley is missing');
check(
  /shots\.push\(\{ offsetX: -offset[\s\S]*?shots\.push\(\{ offsetX: offset/.test(volley),
  'barrels must be added as a matched pair, or the gun goes lopsided again',
);
check(
  /if \(shots\.length \+ 2 > MAX_VOLLEY\) break;/.test(volley),
  'the cap must be checked for the whole pair, or a volley can end mid-pair',
);
check(!/i % 2 === 1 \? -1 : 1/.test(volley), 'the alternating-sides loop is back');

// ---- there is always a choice, and a finished track says MAX ------------
const open = game.split('private openUpgradeChoice(): void {')[1]?.split('\n  }\n')[0] ?? '';
check(open.length > 0, 'openUpgradeChoice is missing');
check(
  !/this\.score \+= \d+;\s*\n\s*return;/.test(open),
  'a rank must never be converted to score without showing the player anything',
);
check(/offer\.length >= UPGRADE_CHOICES/.test(open), 'the offer should pad to a fixed card count');
check(/UPGRADE_CHOICES/.test(open), 'the card count should come from the constant');

// Every track has a ceiling, so MAX is a state the player can actually reach.
const available = game.split('private upgradeAvailable(')[1]?.split('\n  }\n')[0] ?? '';
for (const [kind, cap] of [
  ['shield', 'SHIELD_CAP'], ['bomb', 'BOMB_POWER_CAP'],
  ['pulse', 'PULSE_POWER_CAP'], ['barrel', 'MAX_BARRELS'],
]) {
  check(new RegExp(`'${kind}'`).test(available), `"${kind}" has no availability rule`);
  check(available.includes(cap), `"${kind}" needs a ceiling (${cap}) or MAX can never be shown`);
}

// The apply path must refuse a maxed pick -- and must not trap the player when
// EVERY pick is maxed, which is the failure the refusal creates.
const apply = game.split('private applyUpgrade(')[1]?.split('\n  }\n')[0] ?? '';
check(/if \(!this\.upgradeAvailable\(kind\)\)/.test(apply), 'a maxed track must not be spendable');
check(
  /allUpgradesMaxed\(\)/.test(apply),
  'with every track maxed no card is clickable; there must be a way out of the overlay',
);
check(/this\.upgradeOffer = \[\];/.test(apply), 'the all-maxed path must close the overlay');
check(/pendingUpgrades = 0/.test(apply), 'the all-maxed path must clear the queued ranks, or it reopens forever');

// ...and it must PAY for every rank it clears.
//
// awardXp loops -- one boss kill can cross two thresholds at once -- so
// pendingUpgrades is regularly greater than 1. The all-maxed path used to add
// a flat ALL_MAXED_SCORE and then zero the queue, so two ranks banked together
// paid 250 instead of 500 and the second vanished with no message. Clearing
// the queue and paying for one of it is the pairing that has to stay wrong
// together to be a bug, so both halves are asserted here.
{
  const code = apply.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  check(
    /this\.score \+= ALL_MAXED_SCORE \* /.test(code) || /reward = ALL_MAXED_SCORE \* /.test(code),
    'banking an all-maxed rank must pay per queued rank — a flat award silently loses the rest',
  );
  check(
    !/this\.score \+= ALL_MAXED_SCORE;/.test(code),
    'a flat ALL_MAXED_SCORE award drops every rank past the first',
  );
}

// The card has to say MAX, and say what a tap will do when nothing is left.
check(/'MAX'/.test(game), 'a finished track should be labelled MAX on its card');
check(/TAP TO BANK/.test(game), 'an all-maxed overlay should say what tapping does');

// ---- a boss is worth a pick ---------------------------------------------
const kill = game.split('private damageBoss(')[1]?.split('\n  }\n')[0] ?? '';
check(
  /this\.pendingUpgrades \+= BOSS_UPGRADE_REWARD;/.test(kill),
  'defeating a boss should grant an upgrade choice, not just score',
);
check(num('BOSS_UPGRADE_REWARD') >= 1, 'the boss reward must actually be worth something');

// ---- rank is not a level ------------------------------------------------
check(!/`LEVEL \$\{this\.xpLevel\}`/.test(game), 'the level-up overlay should say RANK, not LEVEL');
check(/`RANK \$\{this\.xpLevel\}`/.test(game), 'the level-up overlay should show the rank');

if (failures.length > 0) {
  console.error('upgrade-choices validation FAILED:');
  for (const line of failures) console.error(`  - ${line}`);
  process.exit(1);
}
console.log(`upgrade-choices: OK — ${weapons.length} guns symmetric at every barrel count, ${'choices always shown'}.`);
