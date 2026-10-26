// Lightweight ES-module linking smoke test.
//
// `node --check` only parses a file; it does not resolve named imports.
// This script catches missing named exports such as the M1 KANJI/render bugs.
//
// Deliberately does NOT import main.js: its dependency graph accesses
// browser DOM and canvas APIs and cannot run in Node.

import assert from 'node:assert/strict';
import { KANJI } from '../mobile/js/eras.js';
import { SugorokuCore } from '../mobile/js/core.js';

assert.ok(Array.isArray(KANJI), 'KANJI must be exported as an array');
assert.equal(
  KANJI.length,
  25,
  `KANJI must contain 25 entries, got ${KANJI.length}`,
);
assert.equal(
  KANJI[6],
  '六',
  `KANJI[6] must be '六', got ${JSON.stringify(KANJI[6])}`,
);
assert.ok(
  SugorokuCore !== null && typeof SugorokuCore === 'object',
  'SugorokuCore must be exported as an object',
);
assert.ok(
  Object.keys(SugorokuCore).length > 0,
  'SugorokuCore must expose at least one member',
);

console.log(
  `ES module import smoke test passed: KANJI=${KANJI.length} entries, ` +
  `SugorokuCore=${Object.keys(SugorokuCore).length} members`,
);
