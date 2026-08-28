// Acceptance check for the Level 1 warship room backgrounds.
//
// GPT sends these as a set plus a SHA256 manifest. Two earlier interior WebPs
// reached the repo truncated and still decoded far enough to render as a
// near-black room, so "the file is there and the browser accepts it" has
// already proved worthless once. This compares byte length and content hash
// against what the sender says it produced, before anything gets wired up.
//
// Not part of `npm test`: it is a one-time gate on an incoming handoff, and a
// check that passes because its inputs are absent is worse than no check.
// Run it with `npm run verify:rooms`.

import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';

const MANIFEST = 'docs/assets/level1-interior-room-backgrounds.sha256.json';
const DEST = 'public/assets/interior';

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const rows = [];
let missing = 0;
let bad = 0;

for (const entry of manifest.files) {
  const path = `${DEST}/${entry.filename}`;
  if (!existsSync(path)) {
    rows.push(`  MISSING   ${entry.filename}  (expected ${entry.bytes} bytes)`);
    missing += 1;
    continue;
  }
  const data = readFileSync(path);
  const sha = createHash('sha256').update(data).digest('hex');
  if (data.length !== entry.bytes) {
    rows.push(`  TRUNCATED ${entry.filename}  ${data.length} of ${entry.bytes} bytes (${entry.bytes - data.length} short)`);
    bad += 1;
  } else if (sha !== entry.sha256) {
    rows.push(`  CORRUPT   ${entry.filename}  sha256 ${sha.slice(0, 16)}… != ${entry.sha256.slice(0, 16)}…`);
    bad += 1;
  } else {
    rows.push(`  OK        ${entry.filename}  ${data.length} bytes`);
  }
}

console.log(`${manifest.target}\nexpected ${manifest.dimensions}\n`);
for (const row of rows) console.log(row);

if (missing > 0 || bad > 0) {
  console.error(
    `\n${missing} missing, ${bad} damaged of ${manifest.files.length}.`
    + '\nUpload the .webp files to the repository -- that is the transfer path that has worked;'
    + '\nchat attachments have arrived split or truncated every time.',
  );
  process.exit(1);
}
console.log(`\nAll ${manifest.files.length} room backgrounds match the manifest. Safe to wire up.`);
