// Forced restart onto a new build.
//
// People keep this open on a phone for a long time, so a deploy used to reach
// nobody already playing: they carried on in whatever build they first loaded,
// and reports came back against code that no longer existed.
//
// Detection needs no build step. Vite content-hashes the entry bundle, so
// `assets/index-<hash>.js` in the served HTML IS the version.

import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const bundle = await build({
  entryPoints: ['src/game/core/UpdateWatch.ts'],
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'silent',
});
const { currentBundle, bundleFromHtml } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
);

// ---- version detection --------------------------------------------------
check(
  currentBundle('https://x.app/assets/index-BuwOq8Zq.js') === 'assets/index-BuwOq8Zq.js',
  'a built module URL should yield its bundle name',
);
// Dev serves the unhashed entry. There is no version there, and polling in dev
// would reload the page on every HMR edit.
check(currentBundle('http://localhost:5173/src/main.ts') === null, 'dev must report no version');

const html = '<script type="module" crossorigin src="/assets/index-Dds9LaZc.js"></script>';
check(bundleFromHtml(html) === 'assets/index-Dds9LaZc.js', 'should read the bundle name out of served HTML');
check(bundleFromHtml('<html><body>nothing</body></html>') === null, 'HTML with no bundle should yield null');
// Two different builds must compare unequal -- that comparison IS the feature.
check(
  bundleFromHtml('<script src="/assets/index-AAA.js">') !== bundleFromHtml('<script src="/assets/index-BBB.js">'),
  'different builds must not compare equal',
);

// ---- the watcher's own safety rules -------------------------------------
const source = readFileSync('src/game/core/UpdateWatch.ts', 'utf8');
const watcher = source.split('export function watchForUpdates(')[1] ?? '';

check(/if \(!running\) return;/.test(watcher), 'the watcher must not run in dev, where there is no version to compare');
check(/cache: 'no-store'/.test(source), 'the version fetch must bypass cache, or it reports the running build forever');
check(/\?v=\$\{Date\.now\(\)\}/.test(source), 'the version fetch needs a cache-buster as well as no-store');
check(/catch \{/.test(watcher), 'a failed fetch must be swallowed -- offline is not a reason to do anything');
check(/document\.hidden/.test(watcher), 'do not poll a hidden tab');
check(/visibilitychange/.test(watcher), 'check on return to the tab: that is when a player is most likely behind');

// The loop guard. Without it, an edge serving stale HTML on reload spins the
// player through restart after restart.
check(/PENDING_KEY/.test(watcher), 'the watcher needs a marker for the build it already reloaded for');
check(
  /if \(read\(PENDING_KEY\) === latest\) return;/.test(watcher),
  'reloading twice for the same build must be refused, or a stale edge causes a reload loop',
);
check(
  /if \(read\(PENDING_KEY\) === running\) write\(PENDING_KEY, null\);/.test(watcher),
  'the marker must clear once the new build is actually running, or one update blocks the next',
);
check(/restarting/.test(watcher), 'a restart in flight must not be started twice');

// Storage can throw in private browsing; a watcher that cannot remember should
// still watch.
check(/try \{[\s\S]*?sessionStorage/.test(source), 'sessionStorage access must be guarded');

// It has to say something before yanking the player out of a run.
check(/showNotice/.test(watcher), 'a forced restart needs a notice');
check(/NEW VERSION/.test(source), 'the notice should say what is happening');
const noticeMs = Number(/const NOTICE_MS = (\d+);/.exec(source)?.[1]);
check(noticeMs >= 1500 && noticeMs <= 6000, `the notice shows for ${noticeMs}ms; too brief to read or too long to wait`);
const pollMs = Number(/const POLL_MS = ([\d_]+);/.exec(source)?.[1].replace(/_/g, ''));
check(pollMs >= 30000, `polling every ${pollMs}ms is heavier than a deploy check needs`);

// And it has to be switched on.
const main = readFileSync('src/main.ts', 'utf8');
check(/watchForUpdates\(import\.meta\.url\)/.test(main), 'watchForUpdates is never called from main');

if (failures.length > 0) {
  console.error('force-update validation FAILED:');
  for (const line of failures) console.error(`  - ${line}`);
  process.exit(1);
}
console.log(`force-update: OK — new builds detected by bundle hash, ${noticeMs}ms notice, loop-guarded.`);
