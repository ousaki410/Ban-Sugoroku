// Deterministic JavaScript rules/AI regression tests for Ban-Sugoroku.
//
// Scope:
// - Imports only browser-safe modules (eras.js and core.js).
// - Does not import main.js or state.js; those require DOM/canvas setup.
// - Uses Node's built-in assert only; no npm dependencies.
//
// Representation notes verified against mobile/js/core.js:
// - pts is a 24-entry integer array. Positive = Black, negative = White.
// - Black moves toward lower indices; White moves toward higher indices.
// - bar is [blackCount, whiteCount]; off is [blackCount, whiteCount].
// - getLegalSteps() does not consume dice; callers remove one die per step.
// - AI returns primitive steps, not expanded UI targets.
// - Bear-off steps use the string sentinel 'off'. Numeric local calculations
//   remain inside getLegalSteps() only for exact-die/oversized-die eligibility.
//
// Run: node tools/test_js_rules.mjs
// Exit code: 0 when all tests pass; 1 when any test fails.

import assert from 'node:assert/strict';
import { SugorokuCore } from '../mobile/js/core.js';
import { ERA_MODES } from '../mobile/js/eras.js';

const BLACK = 0;
const WHITE = 1;

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`  FAIL ${name}`);
    const message = err && err.message ? err.message : String(err);
    for (const line of message.split('\n')) console.log(`       ${line}`);
  }
}

function group(title) {
  console.log(`\n${title}`);
}

function emptyBoard() {
  return new Array(24).fill(0);
}

function modeById(id) {
  const mode = ERA_MODES.find(m => m.id === id);
  assert.ok(mode, `ERA_MODES is missing ${id}`);
  return mode;
}

function makeState(pts, bar = [0, 0], off = [0, 0]) {
  return { pts: pts.slice(), bar: bar.slice(), off: off.slice() };
}

function findStep(steps, from, to, die) {
  return steps.find(s =>
    s.from === from &&
    s.to === to &&
    (die === undefined || s.die === die)
  );
}

function assertStep(steps, from, to, die, message) {
  const step = findStep(steps, from, to, die);
  assert.ok(
    step,
    message || `expected step ${from}->${to} die ${die}; got ${JSON.stringify(steps)}`
  );
  return step;
}

function assertNoStep(steps, from, to, die, message) {
  const step = findStep(steps, from, to, die);
  assert.equal(
    step,
    undefined,
    message || `unexpected step ${from}->${to} die ${die}; got ${JSON.stringify(steps)}`
  );
}

function findBearOffStep(steps, from, die) {
  return steps.find(s =>
    s.from === from &&
    s.die === die &&
    s.to === 'off'
  );
}

function assertBearOffStep(steps, from, die, message) {
  const step = findBearOffStep(steps, from, die);
  assert.ok(
    step,
    message || `expected a bear-off step from ${from} with die ${die}; got ${JSON.stringify(steps)}`
  );
  return step;
}

function assertNoBearOffStep(steps, from, die, message) {
  const step = findBearOffStep(steps, from, die);
  assert.equal(
    step,
    undefined,
    message || `unexpected bear-off step from ${from} with die ${die}; got ${JSON.stringify(steps)}`
  );
}

function assertBoardInvariants(next, player, mode, messagePrefix) {
  assert.equal(next.pts.length, 24, `${messagePrefix}: points array must remain length 24`);
  assert.ok(
    next.pts.every(value => Number.isFinite(value)),
    `${messagePrefix}: no point may become NaN or Infinity`
  );
  if (player === BLACK) {
    assert.equal(
      sumPositive(next.pts) + next.bar[0] + next.off[0],
      mode.stoneCount,
      `${messagePrefix}: Black stone-count invariant`
    );
  } else {
    assert.equal(
      sumNegativeMagnitude(next.pts) + next.bar[1] + next.off[1],
      mode.stoneCount,
      `${messagePrefix}: White stone-count invariant`
    );
  }
}

function nonZeroPoints(pts) {
  const out = {};
  pts.forEach((value, index) => {
    if (value !== 0) out[index] = value;
  });
  return out;
}

function sumPositive(pts) {
  return pts.reduce((sum, value) => sum + (value > 0 ? value : 0), 0);
}

function sumNegativeMagnitude(pts) {
  return pts.reduce((sum, value) => sum + (value < 0 ? -value : 0), 0);
}

function replayAiSequence(mode, player, initialPts, initialBar, initialOff, remDice, rolledPair = false) {
  const seq = SugorokuCore.findBestAiTurn(
    initialPts.slice(),
    initialBar.slice(),
    initialOff.slice(),
    player,
    remDice.slice(),
    mode,
    rolledPair
  );
  let current = makeState(initialPts, initialBar, initialOff);
  const diceLeft = remDice.slice();

  for (const step of seq) {
    const legalNow = SugorokuCore.getLegalSteps(
      current.pts,
      current.bar,
      current.off,
      player,
      diceLeft,
      mode,
      rolledPair
    );
    const match = legalNow.find(s =>
      s.from === step.from &&
      s.to === step.to &&
      s.die === step.die
    );
    assert.ok(
      match,
      `AI step ${JSON.stringify(step)} is not legal with remaining dice ${JSON.stringify(diceLeft)}; legal now: ${JSON.stringify(legalNow)}`
    );

    const next = SugorokuCore.cloneApplyStep(
      current.pts,
      current.bar,
      current.off,
      player,
      step,
      mode
    );
    current = { pts: next.pts, bar: next.bar, off: next.off };

    const dieIndex = diceLeft.indexOf(step.die);
    assert.notEqual(
      dieIndex,
      -1,
      `AI step die ${step.die} is not in remaining dice ${JSON.stringify(diceLeft)}`
    );
    diceLeft.splice(dieIndex, 1);
  }

  return { seq, state: current, diceLeft };
}

// ==================== Era setup and mode flags ====================

group('Era setup and mode flags');

test('all six ERA_MODES expose the expected 24-point setup and stone counts', () => {
  const expected = {
    heian_kuge: { 0: -5, 5: 5, 11: -5, 12: 5, 18: -5, 23: 5 },
    kamakura_jike: { 0: -2, 5: 5, 7: 3, 11: -4, 12: 4, 16: -3, 18: -5, 23: 2 },
    muromachi_buke: { 0: -2, 5: 5, 7: 3, 11: -5, 12: 5, 16: -3, 18: -5, 23: 2 },
    sengoku_yamato: { 0: -2, 5: 5, 7: 3, 11: -5, 12: 5, 16: -3, 18: -5, 23: 2 },
    edo_oriha: { 0: -12, 23: 12 },
    edo_oimawashi: {
      6: -2, 7: -2, 8: -2, 9: -2, 10: -2, 11: -2,
      18: 2, 19: 2, 20: 2, 21: 2, 22: 2, 23: 2
    }
  };

  assert.equal(ERA_MODES.length, 6, 'expected exactly six eras');
  for (const mode of ERA_MODES) {
    assert.ok(expected[mode.id], `unexpected era id ${mode.id}`);
    const pts = emptyBoard();
    mode.setup(pts);
    assert.equal(pts.length, 24, `${mode.id} setup must leave a 24-point board`);
    assert.deepEqual(nonZeroPoints(pts), expected[mode.id], `${mode.id} setup mismatch`);
    assert.equal(sumPositive(pts), mode.stoneCount, `${mode.id} Black stone count`);
    assert.equal(sumNegativeMagnitude(pts), mode.stoneCount, `${mode.id} White stone count`);
  }
});

test('mode flags assumed by the tests match the era definitions', () => {
  const heian = modeById('heian_kuge');
  assert.equal(heian.stoneCount, 15);
  assert.equal(heian.zoromeMoves, 2);
  assert.equal(heian.canBearOff, false);
  assert.equal(heian.allowMujiWin, true);
  assert.equal(heian.allowIkkaSmash, false);
  assert.equal(heian.freeBarEntry, false);
  assert.equal(heian.isOimawashi, false);

  const kamakura = modeById('kamakura_jike');
  assert.equal(kamakura.stoneCount, 14);
  assert.equal(kamakura.zoromeMoves, 4);
  assert.equal(kamakura.allowIkkaSmash, true);

  const muromachi = modeById('muromachi_buke');
  assert.equal(muromachi.stoneCount, 15);
  assert.equal(muromachi.zoromeMoves, 4);
  assert.equal(muromachi.canBearOff, false);
  assert.equal(muromachi.allowMujiWin, true);
  assert.equal(muromachi.allowIkkaSmash, false);
  assert.equal(muromachi.freeBarEntry, false);
  assert.equal(muromachi.isOimawashi, false);

  const yamato = modeById('sengoku_yamato');
  assert.equal(yamato.stoneCount, 15);
  assert.equal(yamato.canBearOff, true);
  assert.equal(yamato.allowMujiWin, false);
  assert.equal(yamato.allowIkkaSmash, false);
  assert.equal(yamato.freeBarEntry, true);
  assert.equal(yamato.isOimawashi, false);

  const oriha = modeById('edo_oriha');
  assert.equal(oriha.stoneCount, 12);
  assert.equal(oriha.canBearOff, true);
  assert.equal(oriha.freeBarEntry, false);

  const oimawashi = modeById('edo_oimawashi');
  assert.equal(oimawashi.stoneCount, 12);
  assert.equal(oimawashi.canBearOff, false);
  assert.equal(oimawashi.isOimawashi, true);
});

// ==================== Basic movement and captures ====================

group('Basic movement and captures');

test('Black moves to an empty point', () => {
  const mode = modeById('muromachi_buke');
  const pts = emptyBoard();
  pts[12] = 5;
  const steps = SugorokuCore.getLegalSteps(pts, [0, 0], [0, 0], BLACK, [3], mode, false);
  assert.equal(steps.length, 1, `expected one step; got ${JSON.stringify(steps)}`);
  const step = assertStep(steps, 12, 9, 3);
  assert.equal(step.dIdx, 0);
});

test('White moves to an empty point', () => {
  const mode = modeById('muromachi_buke');
  const pts = emptyBoard();
  pts[12] = -5;
  const steps = SugorokuCore.getLegalSteps(pts, [0, 0], [0, 0], WHITE, [3], mode, false);
  assert.equal(steps.length, 1, `expected one step; got ${JSON.stringify(steps)}`);
  assertStep(steps, 12, 15, 3);
});

test('Black cannot land on a point holding two or more enemy stones', () => {
  const mode = modeById('muromachi_buke');
  const pts = emptyBoard();
  pts[12] = 5;
  pts[9] = -2;
  const steps = SugorokuCore.getLegalSteps(pts, [0, 0], [0, 0], BLACK, [3], mode, false);
  assert.equal(steps.length, 0, `expected no steps; got ${JSON.stringify(steps)}`);
  assertNoStep(steps, 12, 9, 3);
});

test('White cannot land on a point holding two or more enemy stones', () => {
  const mode = modeById('muromachi_buke');
  const pts = emptyBoard();
  pts[12] = -5;
  pts[15] = 2;
  const steps = SugorokuCore.getLegalSteps(pts, [0, 0], [0, 0], WHITE, [3], mode, false);
  assert.equal(steps.length, 0, `expected no steps; got ${JSON.stringify(steps)}`);
  assertNoStep(steps, 12, 15, 3);
});

test('Black hit sends a single White blot to the bar and leaves a Black blot', () => {
  const mode = modeById('muromachi_buke');
  const pts = emptyBoard();
  pts[12] = 5;
  pts[9] = -1;
  const bar = [0, 0];
  const off = [0, 0];
  const before = makeState(pts, bar, off);

  const steps = SugorokuCore.getLegalSteps(pts, bar, off, BLACK, [3], mode, false);
  const step = assertStep(steps, 12, 9, 3);
  const next = SugorokuCore.cloneApplyStep(pts, bar, off, BLACK, step, mode);

  assert.equal(next.hit, true);
  assert.equal(next.pts[12], 4);
  assert.equal(next.pts[9], 1);
  assert.deepEqual(next.bar, [0, 1]);
  assert.deepEqual(next.off, [0, 0]);
  assert.deepEqual(pts, before.pts, 'cloneApplyStep mutated pts');
  assert.deepEqual(bar, before.bar, 'cloneApplyStep mutated bar');
  assert.deepEqual(off, before.off, 'cloneApplyStep mutated off');
});

test('White hit sends a single Black blot to the bar and leaves a White blot', () => {
  const mode = modeById('muromachi_buke');
  const pts = emptyBoard();
  pts[12] = -5;
  pts[15] = 1;
  const bar = [0, 0];
  const off = [0, 0];
  const before = makeState(pts, bar, off);

  const steps = SugorokuCore.getLegalSteps(pts, bar, off, WHITE, [3], mode, false);
  const step = assertStep(steps, 12, 15, 3);
  const next = SugorokuCore.cloneApplyStep(pts, bar, off, WHITE, step, mode);

  assert.equal(next.hit, true);
  assert.equal(next.pts[12], -4);
  assert.equal(next.pts[15], -1);
  assert.deepEqual(next.bar, [1, 0]);
  assert.deepEqual(next.off, [0, 0]);
  assert.deepEqual(pts, before.pts, 'cloneApplyStep mutated pts');
  assert.deepEqual(bar, before.bar, 'cloneApplyStep mutated bar');
  assert.deepEqual(off, before.off, 'cloneApplyStep mutated off');
});

test('pure transitions do not mutate caller state', () => {
  const mode = modeById('muromachi_buke');
  const pts = emptyBoard();
  pts[12] = 5;
  pts[9] = -1;
  const bar = [0, 0];
  const off = [0, 0];
  const remDice = [3, 4];
  const before = {
    pts: pts.slice(),
    bar: bar.slice(),
    off: off.slice(),
    dice: remDice.slice()
  };

  const steps = SugorokuCore.getLegalSteps(pts, bar, off, BLACK, remDice, mode, false);
  assert.deepEqual(pts, before.pts, 'getLegalSteps mutated pts');
  assert.deepEqual(bar, before.bar, 'getLegalSteps mutated bar');
  assert.deepEqual(off, before.off, 'getLegalSteps mutated off');
  assert.deepEqual(remDice, before.dice, 'getLegalSteps mutated remDice');

  const hit = assertStep(steps, 12, 9, 3);
  const next = SugorokuCore.cloneApplyStep(pts, bar, off, BLACK, hit, mode);
  assert.notStrictEqual(next.pts, pts, 'cloneApplyStep must return a new pts array');
  assert.notStrictEqual(next.bar, bar, 'cloneApplyStep must return a new bar array');
  assert.notStrictEqual(next.off, off, 'cloneApplyStep must return a new off array');
  assert.deepEqual(pts, before.pts, 'cloneApplyStep mutated pts');
  assert.deepEqual(bar, before.bar, 'cloneApplyStep mutated bar');
  assert.deepEqual(off, before.off, 'cloneApplyStep mutated off');

  const seq = SugorokuCore.findBestAiTurn(pts, bar, off, BLACK, remDice, mode, false);
  assert.ok(seq.length > 0, 'AI should find a move in this position');
  assert.deepEqual(pts, before.pts, 'findBestAiTurn mutated pts');
  assert.deepEqual(bar, before.bar, 'findBestAiTurn mutated bar');
  assert.deepEqual(off, before.off, 'findBestAiTurn mutated off');
  assert.deepEqual(remDice, before.dice, 'findBestAiTurn mutated remDice');
});

// ==================== Bear-off legal generation and application ====================

group('Bear-off legal generation and application');

test('Black exact-die bear-off applies through the production transition API', () => {
  const mode = modeById('sengoku_yamato');
  const pts = emptyBoard();
  pts[0] = 5;
  pts[1] = 5;
  pts[2] = 5;
  const bar = [0, 0];
  const off = [0, 0];

  assert.equal(
    SugorokuCore.allInInnerOrOff(pts, bar, off, BLACK, mode),
    true,
    'fixture must have all Black stones inside the home board or off'
  );
  const steps = SugorokuCore.getLegalSteps(pts, bar, off, BLACK, [1], mode, false);
  const bearOff = assertBearOffStep(steps, 0, 1);
  assert.equal(bearOff.to, 'off', 'bear-off steps must use the off sentinel');
  assertStep(steps, 1, 0, 1);
  assertStep(steps, 2, 1, 1);

  const next = SugorokuCore.cloneApplyStep(pts, bar, off, BLACK, bearOff, mode);
  assert.equal(next.pts[0], 4, 'source point must decrease by one');
  assert.deepEqual(next.off, [1, 0], 'Black off count must increase');
  assert.deepEqual(next.bar, [0, 0]);
  assert.equal(next.hit, false);
  assertBoardInvariants(next, BLACK, mode, 'Black exact-die bear-off');
});

test('White exact-die bear-off applies through the production transition API', () => {
  const mode = modeById('sengoku_yamato');
  const pts = emptyBoard();
  pts[23] = -1;
  pts[18] = -7;
  pts[19] = -7;
  const bar = [0, 0];
  const off = [0, 0];

  assert.equal(
    SugorokuCore.allInInnerOrOff(pts, bar, off, WHITE, mode),
    true,
    'fixture must have all White stones inside the home board or off'
  );
  const steps = SugorokuCore.getLegalSteps(pts, bar, off, WHITE, [1], mode, false);
  const bearOff = assertBearOffStep(steps, 23, 1);
  assert.equal(bearOff.to, 'off', 'bear-off steps must use the off sentinel');
  assertStep(steps, 18, 19, 1);
  assertStep(steps, 19, 20, 1);

  const next = SugorokuCore.cloneApplyStep(pts, bar, off, WHITE, bearOff, mode);
  assert.equal(next.pts[23], 0, 'source point must increase by one toward zero');
  assert.deepEqual(next.off, [0, 1], 'White off count must increase');
  assert.deepEqual(next.bar, [0, 0]);
  assert.equal(next.hit, false);
  assertBoardInvariants(next, WHITE, mode, 'White exact-die bear-off');
});

test('Black oversized-die bear-off is rejected by a higher friendly stone, while exact-die applies', () => {
  const mode = modeById('sengoku_yamato');
  const pts = emptyBoard();
  pts[0] = 1;
  pts[3] = 1;
  pts[1] = 13;
  const bar = [0, 0];
  const off = [0, 0];

  assert.equal(SugorokuCore.allInInnerOrOff(pts, bar, off, BLACK, mode), true);
  const steps = SugorokuCore.getLegalSteps(pts, bar, off, BLACK, [2], mode, false);
  assertNoBearOffStep(
    steps,
    0,
    2,
    'oversized bear-off from 0 must be blocked by the friendly stone at 3'
  );
  const exact = assertBearOffStep(
    steps,
    1,
    2,
    'exact-die bear-off from 1 is allowed even with a higher friendly stone'
  );
  assert.equal(exact.to, 'off');
  assertStep(steps, 3, 1, 2);

  const next = SugorokuCore.cloneApplyStep(pts, bar, off, BLACK, exact, mode);
  assert.equal(next.pts[1], 12, 'source point must decrease by one');
  assert.deepEqual(next.off, [1, 0], 'Black off count must increase');
  assert.deepEqual(next.bar, [0, 0]);
  assert.equal(next.hit, false);
  assertBoardInvariants(next, BLACK, mode, 'Black exact-die bear-off with higher stone');
});

test('Black oversized-die bear-off applies when no higher friendly stone remains', () => {
  const mode = modeById('sengoku_yamato');
  const pts = emptyBoard();
  pts[0] = 1;
  const bar = [0, 0];
  const off = [14, 0];

  assert.equal(SugorokuCore.allInInnerOrOff(pts, bar, off, BLACK, mode), true);
  const steps = SugorokuCore.getLegalSteps(pts, bar, off, BLACK, [2], mode, false);
  const bearOff = assertBearOffStep(steps, 0, 2);
  assert.equal(bearOff.to, 'off');

  const next = SugorokuCore.cloneApplyStep(pts, bar, off, BLACK, bearOff, mode);
  assert.equal(next.pts[0], 0, 'last home-board stone must leave the board');
  assert.deepEqual(next.off, [15, 0], 'Black off count must reach stoneCount');
  assert.deepEqual(next.bar, [0, 0]);
  assert.equal(next.hit, false);
  assertBoardInvariants(next, BLACK, mode, 'Black oversized-die bear-off');
});

test('White oversized-die bear-off is rejected by a lower friendly stone, while exact-die applies', () => {
  const mode = modeById('sengoku_yamato');
  const pts = emptyBoard();
  pts[23] = -1;
  pts[20] = -1;
  pts[22] = -13;
  const bar = [0, 0];
  const off = [0, 0];

  assert.equal(SugorokuCore.allInInnerOrOff(pts, bar, off, WHITE, mode), true);
  const steps = SugorokuCore.getLegalSteps(pts, bar, off, WHITE, [2], mode, false);
  assertNoBearOffStep(
    steps,
    23,
    2,
    'oversized bear-off from 23 must be blocked by the friendly stone at 20'
  );
  const exact = assertBearOffStep(
    steps,
    22,
    2,
    'exact-die bear-off from 22 is allowed even with a lower friendly stone'
  );
  assert.equal(exact.to, 'off');
  assertStep(steps, 20, 22, 2);

  const next = SugorokuCore.cloneApplyStep(pts, bar, off, WHITE, exact, mode);
  assert.equal(next.pts[22], -12, 'source point must increase by one toward zero');
  assert.deepEqual(next.off, [0, 1], 'White off count must increase');
  assert.deepEqual(next.bar, [0, 0]);
  assert.equal(next.hit, false);
  assertBoardInvariants(next, WHITE, mode, 'White exact-die bear-off with lower stone');
});

test('White oversized-die bear-off applies when no lower friendly stone remains', () => {
  const mode = modeById('sengoku_yamato');
  const pts = emptyBoard();
  pts[23] = -1;
  const bar = [0, 0];
  const off = [0, 14];

  assert.equal(SugorokuCore.allInInnerOrOff(pts, bar, off, WHITE, mode), true);
  const steps = SugorokuCore.getLegalSteps(pts, bar, off, WHITE, [2], mode, false);
  const bearOff = assertBearOffStep(steps, 23, 2);
  assert.equal(bearOff.to, 'off');

  const next = SugorokuCore.cloneApplyStep(pts, bar, off, WHITE, bearOff, mode);
  assert.equal(next.pts[23], 0, 'last home-board stone must leave the board');
  assert.deepEqual(next.off, [0, 15], 'White off count must reach stoneCount');
  assert.deepEqual(next.bar, [0, 0]);
  assert.equal(next.hit, false);
  assertBoardInvariants(next, WHITE, mode, 'White oversized-die bear-off');
});

test('expanded bear-off targets use the off sentinel and apply cleanly for both colors', () => {
  const mode = modeById('sengoku_yamato');

  const blackPts = emptyBoard();
  blackPts[0] = 5;
  blackPts[1] = 5;
  blackPts[2] = 5;
  const blackTargets = SugorokuCore.getExpandedTargetsForSource(
    blackPts,
    [0, 0],
    [0, 0],
    BLACK,
    0,
    [1],
    mode,
    false
  );
  assert.equal(
    blackTargets.length,
    1,
    `expected one Black bear-off target; got ${JSON.stringify(blackTargets)}`
  );
  const blackTarget = blackTargets[0];
  assert.equal(blackTarget.from, 0);
  assert.equal(blackTarget.to, 'off');
  assert.equal(blackTarget.isCombined, false);
  assert.equal(blackTarget.steps.length, 1);
  assert.equal(blackTarget.steps[0].to, 'off');
  assert.equal(blackTarget.label, '上がり一');

  const blackNext = SugorokuCore.cloneApplyStep(
    blackPts,
    [0, 0],
    [0, 0],
    BLACK,
    blackTarget.steps[0],
    mode
  );
  assert.equal(blackNext.pts[0], 4);
  assert.deepEqual(blackNext.off, [1, 0]);
  assertBoardInvariants(blackNext, BLACK, mode, 'Black expanded bear-off target');

  const whitePts = emptyBoard();
  whitePts[23] = -1;
  whitePts[18] = -7;
  whitePts[19] = -7;
  const whiteTargets = SugorokuCore.getExpandedTargetsForSource(
    whitePts,
    [0, 0],
    [0, 0],
    WHITE,
    23,
    [1],
    mode,
    false
  );
  const whiteTarget = whiteTargets.find(t => t.to === 'off');
  assert.ok(
    whiteTarget,
    `expected a White bear-off target; got ${JSON.stringify(whiteTargets)}`
  );
  assert.equal(whiteTarget.from, 23);
  assert.equal(whiteTarget.isCombined, false);
  assert.equal(whiteTarget.steps.length, 1);
  assert.equal(whiteTarget.steps[0].to, 'off');
  assert.equal(whiteTarget.label, '上がり一');

  const whiteNext = SugorokuCore.cloneApplyStep(
    whitePts,
    [0, 0],
    [0, 0],
    WHITE,
    whiteTarget.steps[0],
    mode
  );
  assert.equal(whiteNext.pts[23], 0);
  assert.deepEqual(whiteNext.off, [0, 1]);
  assertBoardInvariants(whiteNext, WHITE, mode, 'White expanded bear-off target');
});

// ==================== Bar entry ====================

group('Bar entry');

test('fixed bar entry sends Black to 24 - die', () => {
  const mode = modeById('muromachi_buke');
  const steps = SugorokuCore.getLegalSteps(emptyBoard(), [1, 0], [0, 0], BLACK, [3], mode, false);
  assert.equal(steps.length, 1, `expected one step; got ${JSON.stringify(steps)}`);
  assertStep(steps, 'bar', 21, 3);
});

test('fixed bar entry sends White to die - 1', () => {
  const mode = modeById('muromachi_buke');
  const steps = SugorokuCore.getLegalSteps(emptyBoard(), [0, 1], [0, 0], WHITE, [3], mode, false);
  assert.equal(steps.length, 1, `expected one step; got ${JSON.stringify(steps)}`);
  assertStep(steps, 'bar', 2, 3);
});

test('fixed bar entry produces no move when its only destination is blocked', () => {
  const mode = modeById('muromachi_buke');
  const pts = emptyBoard();
  pts[21] = -2;
  const steps = SugorokuCore.getLegalSteps(pts, [1, 0], [0, 0], BLACK, [3], mode, false);
  assert.equal(steps.length, 0, `expected no steps; got ${JSON.stringify(steps)}`);
});

test('free-range bar entry lets Black re-enter on any legal start point', () => {
  const mode = modeById('sengoku_yamato');
  const steps = SugorokuCore.getLegalSteps(emptyBoard(), [1, 0], [0, 0], BLACK, [3], mode, false);
  assert.equal(steps.length, 6, `expected six entry points; got ${JSON.stringify(steps)}`);
  for (const to of [23, 22, 21, 20, 19, 18]) {
    assertStep(steps, 'bar', to, 3);
  }
  for (const step of steps) {
    assert.equal(step.from, 'bar');
    assert.equal(step.die, 3);
  }
});

test('free-range bar entry lets White re-enter on any legal start point', () => {
  const mode = modeById('sengoku_yamato');
  const steps = SugorokuCore.getLegalSteps(emptyBoard(), [0, 1], [0, 0], WHITE, [3], mode, false);
  assert.equal(steps.length, 6, `expected six entry points; got ${JSON.stringify(steps)}`);
  for (const to of [0, 1, 2, 3, 4, 5]) {
    assertStep(steps, 'bar', to, 3);
  }
});

test('free-range bar entry respects blocked points and single enemy blots', () => {
  const mode = modeById('sengoku_yamato');
  const pts = emptyBoard();
  pts[23] = -2;
  pts[22] = -1;
  const steps = SugorokuCore.getLegalSteps(pts, [1, 0], [0, 0], BLACK, [3], mode, false);
  assert.equal(steps.length, 5, `expected five entry points; got ${JSON.stringify(steps)}`);
  assertNoStep(steps, 'bar', 23, 3);
  assertStep(steps, 'bar', 22, 3);
  for (const to of [21, 20, 19, 18]) {
    assertStep(steps, 'bar', to, 3);
  }
});

test('free-range bar entry produces no move when every start point is blocked for Black', () => {
  const mode = modeById('sengoku_yamato');
  const pts = emptyBoard();
  for (let i = 18; i <= 23; i++) pts[i] = -2;
  const steps = SugorokuCore.getLegalSteps(pts, [1, 0], [0, 0], BLACK, [3], mode, false);
  assert.equal(steps.length, 0, `expected no steps; got ${JSON.stringify(steps)}`);
});

test('free-range bar entry produces no move when every start point is blocked for White', () => {
  const mode = modeById('sengoku_yamato');
  const pts = emptyBoard();
  for (let i = 0; i <= 5; i++) pts[i] = 2;
  const steps = SugorokuCore.getLegalSteps(pts, [0, 1], [0, 0], WHITE, [3], mode, false);
  assert.equal(steps.length, 0, `expected no steps; got ${JSON.stringify(steps)}`);
});

// ==================== Dice and combined moves ====================

group('Dice and combined moves');

test('legal-move generation uses each remaining die independently', () => {
  const mode = modeById('muromachi_buke');
  const pts = emptyBoard();
  pts[12] = 5;
  pts[10] = 5;
  const remDice = [3, 2];
  const steps = SugorokuCore.getLegalSteps(pts, [0, 0], [0, 0], BLACK, remDice, mode, false);

  assert.equal(steps.length, 4, `expected four steps; got ${JSON.stringify(steps)}`);
  const die3a = assertStep(steps, 10, 7, 3);
  assert.equal(die3a.dIdx, 0);
  const die3b = assertStep(steps, 12, 9, 3);
  assert.equal(die3b.dIdx, 0);
  const die2a = assertStep(steps, 10, 8, 2);
  assert.equal(die2a.dIdx, 1);
  const die2b = assertStep(steps, 12, 10, 2);
  assert.equal(die2b.dIdx, 1);
  assert.deepEqual(remDice, [3, 2], 'getLegalSteps must not consume dice');
});

test('duplicate dice do not duplicate identical primitive steps', () => {
  const mode = modeById('muromachi_buke');
  const pts = emptyBoard();
  pts[12] = 5;
  const steps = SugorokuCore.getLegalSteps(pts, [0, 0], [0, 0], BLACK, [2, 2], mode, false);
  assert.equal(steps.length, 1, `expected one deduplicated step; got ${JSON.stringify(steps)}`);
  const step = assertStep(steps, 12, 10, 2);
  assert.equal(step.dIdx, 0, 'the first matching die index is retained');
});

test('combined two-die target exposes two primitive steps, not a single five-pip die', () => {
  const mode = modeById('muromachi_buke');
  const pts = emptyBoard();
  pts[12] = 1;
  const remDice = [3, 2];
  const targets = SugorokuCore.getExpandedTargetsForSource(
    pts,
    [0, 0],
    [0, 0],
    BLACK,
    12,
    remDice,
    mode,
    false
  );

  assert.equal(
    targets.length,
    3,
    `expected two direct targets and one combined target; got ${JSON.stringify(targets)}`
  );

  const direct = targets.filter(t => !t.isCombined);
  assert.equal(direct.length, 2);
  for (const target of direct) {
    assert.equal(target.steps.length, 1);
    assert.equal(target.steps[0].from, 12);
    assert.equal(target.steps[0].to, target.to);
    assert.equal(target.steps[0].die, target.die);
  }
  assertStep(direct.map(t => t.steps[0]), 12, 10, 2);
  assertStep(direct.map(t => t.steps[0]), 12, 9, 3);

  const combined = targets.find(t => t.isCombined);
  assert.ok(combined, 'expected a combined target');
  assert.equal(combined.from, 12);
  assert.equal(combined.to, 7);
  assert.equal(combined.die, 5, 'combined target die is the sum of the two primitive dice');
  assert.equal(combined.steps.length, 2);
  assert.equal(combined.steps[0].from, 12);
  assert.equal(combined.steps[0].to, 10);
  assert.equal(combined.steps[0].die, 2);
  assert.equal(combined.steps[1].from, 10);
  assert.equal(combined.steps[1].to, 7);
  assert.equal(combined.steps[1].die, 3);
  assert.equal(combined.steps[0].die + combined.steps[1].die, combined.die);

  // Apply the primitive steps sequentially. The expanded target's die=5 is
  // a UI sum and must not be consumed as a single die; the two real dice
  // must be consumed one primitive step at a time.
  let current = makeState(pts);
  const diceLeft = remDice.slice();
  for (const step of combined.steps) {
    const dieIndex = diceLeft.indexOf(step.die);
    assert.notEqual(dieIndex, -1, `primitive die ${step.die} must be available`);
    diceLeft.splice(dieIndex, 1);

    const next = SugorokuCore.cloneApplyStep(
      current.pts,
      current.bar,
      current.off,
      BLACK,
      step,
      mode
    );
    current = { pts: next.pts, bar: next.bar, off: next.off };
  }
  assert.deepEqual(diceLeft, [], 'both primitive dice must be consumed');
  assert.equal(current.pts[12], 0);
  assert.equal(current.pts[10], 0);
  assert.equal(current.pts[7], 1);
  assert.deepEqual(current.bar, [0, 0]);
  assert.deepEqual(current.off, [0, 0]);
});

test('Oimawashi mode does not generate combined targets', () => {
  const mode = modeById('edo_oimawashi');
  const pts = emptyBoard();
  mode.setup(pts);
  const targets = SugorokuCore.getExpandedTargetsForSource(
    pts,
    [0, 0],
    [0, 0],
    BLACK,
    19,
    [3, 2],
    mode,
    false
  );

  assert.equal(targets.length, 2, `expected two direct targets; got ${JSON.stringify(targets)}`);
  for (const target of targets) {
    assert.equal(target.isCombined, false);
    assert.equal(target.steps.length, 1);
  }

  const leap = targets.find(t => t.die === 2);
  assert.ok(leap, 'expected the koi-die (2) target');
  assert.equal(leap.to, 16);
  assert.equal(leap.steps[0].isLeap, true);

  const normal = targets.find(t => t.die === 3);
  assert.ok(normal, 'expected the normal-die (3) target');
  assert.equal(normal.to, 16);
  assert.equal(normal.steps[0].isLeap, false);
});

// ==================== AI ====================

group('AI');

test('AI Black output replays legally from the Muromachi initial setup', () => {
  const mode = modeById('muromachi_buke');
  const pts = emptyBoard();
  mode.setup(pts);
  const bar = [0, 0];
  const off = [0, 0];
  const remDice = [3, 4];

  const { seq, state, diceLeft } = replayAiSequence(mode, BLACK, pts, bar, off, remDice, false);
  assert.ok(seq.length > 0, 'AI should find at least one move');
  assert.ok(seq.length <= remDice.length, 'AI cannot use more dice than were rolled');
  assert.equal(diceLeft.length, remDice.length - seq.length);
  assert.equal(
    sumPositive(state.pts) + state.bar[0] + state.off[0],
    mode.stoneCount,
    'Black stone conservation'
  );
  assert.equal(
    sumNegativeMagnitude(state.pts) + state.bar[1] + state.off[1],
    mode.stoneCount,
    'White stone conservation'
  );
  assert.deepEqual(state.off, [0, 0], 'Muromachi has no bear-off');
  assert.equal(state.pts.length, 24);
});

test('AI White output replays legally from the Muromachi initial setup', () => {
  const mode = modeById('muromachi_buke');
  const pts = emptyBoard();
  mode.setup(pts);
  const bar = [0, 0];
  const off = [0, 0];
  const remDice = [3, 4];

  const { seq, state, diceLeft } = replayAiSequence(mode, WHITE, pts, bar, off, remDice, false);
  assert.ok(seq.length > 0, 'AI should find at least one move');
  assert.ok(seq.length <= remDice.length, 'AI cannot use more dice than were rolled');
  assert.equal(diceLeft.length, remDice.length - seq.length);
  assert.equal(
    sumPositive(state.pts) + state.bar[0] + state.off[0],
    mode.stoneCount,
    'Black stone conservation'
  );
  assert.equal(
    sumNegativeMagnitude(state.pts) + state.bar[1] + state.off[1],
    mode.stoneCount,
    'White stone conservation'
  );
  assert.deepEqual(state.off, [0, 0], 'Muromachi has no bear-off');
});

test('AI hit sequence replays legally and updates the bar', () => {
  const mode = modeById('muromachi_buke');
  const pts = emptyBoard();
  pts[12] = 1;
  pts[9] = -1;
  const bar = [0, 0];
  const off = [0, 0];
  const remDice = [3];

  const { seq, state, diceLeft } = replayAiSequence(mode, BLACK, pts, bar, off, remDice, false);
  assert.equal(seq.length, 1, 'the only legal move is the hit');
  assert.equal(seq[0].from, 12);
  assert.equal(seq[0].to, 9);
  assert.equal(seq[0].die, 3);
  assert.equal(diceLeft.length, 0);
  assert.equal(state.pts[12], 0);
  assert.equal(state.pts[9], 1);
  assert.deepEqual(state.bar, [0, 1]);
  assert.deepEqual(state.off, [0, 0]);
  // Partial-board fixture: no full stone-conservation assertion.
});

test('AI output is deterministic for identical inputs', () => {
  const mode = modeById('muromachi_buke');
  const pts = emptyBoard();
  mode.setup(pts);
  const bar = [0, 0];
  const off = [0, 0];
  const remDice = [3, 4];

  const blackA = SugorokuCore.findBestAiTurn(pts, bar, off, BLACK, remDice, mode, false);
  const blackB = SugorokuCore.findBestAiTurn(pts, bar, off, BLACK, remDice, mode, false);
  assert.deepEqual(blackA, blackB, 'identical inputs must produce identical Black AI sequences');
  assert.ok(blackA.length > 0);

  const whiteA = SugorokuCore.findBestAiTurn(pts, bar, off, WHITE, remDice, mode, false);
  const whiteB = SugorokuCore.findBestAiTurn(pts, bar, off, WHITE, remDice, mode, false);
  assert.deepEqual(whiteA, whiteB, 'identical inputs must produce identical White AI sequences');
  assert.ok(whiteA.length > 0);
});

test('AI returns no sequence when the fixed bar-entry destination is blocked', () => {
  const mode = modeById('muromachi_buke');
  const pts = emptyBoard();
  pts[21] = -2;
  const bar = [1, 0];
  const off = [0, 0];
  const remDice = [3];

  const legal = SugorokuCore.getLegalSteps(pts, bar, off, BLACK, remDice, mode, false);
  assert.equal(legal.length, 0, `expected no legal steps; got ${JSON.stringify(legal)}`);
  const seq = SugorokuCore.findBestAiTurn(pts, bar, off, BLACK, remDice, mode, false);
  assert.deepEqual(seq, []);
});

test('AI returns no sequence when every free-range bar entry is blocked', () => {
  const mode = modeById('sengoku_yamato');
  const pts = emptyBoard();
  for (let i = 18; i <= 23; i++) pts[i] = -2;
  const bar = [1, 0];
  const off = [0, 0];
  const remDice = [3];

  const legal = SugorokuCore.getLegalSteps(pts, bar, off, BLACK, remDice, mode, false);
  assert.equal(legal.length, 0, `expected no legal steps; got ${JSON.stringify(legal)}`);
  const seq = SugorokuCore.findBestAiTurn(pts, bar, off, BLACK, remDice, mode, false);
  assert.deepEqual(seq, []);
});

// ==================== Win conditions ====================

group('Win conditions');

test('bear-off eras win at their exact stoneCount off threshold', () => {
  const yamato = modeById('sengoku_yamato');
  const empty = emptyBoard();
  assert.equal(SugorokuCore.checkWinner(empty, [0, 0], [15, 0], yamato), BLACK);
  assert.equal(SugorokuCore.checkWinner(empty, [0, 0], [0, 15], yamato), WHITE);
  assert.equal(SugorokuCore.checkWinner(empty, [0, 0], [14, 14], yamato), -1);

  const oriha = modeById('edo_oriha');
  assert.equal(SugorokuCore.checkWinner(empty, [0, 0], [12, 0], oriha), BLACK);
  assert.equal(SugorokuCore.checkWinner(empty, [0, 0], [0, 12], oriha), WHITE);
  assert.equal(SugorokuCore.checkWinner(empty, [0, 0], [11, 0], oriha), -1);
});

test('Oimawashi wins at six captured stones', () => {
  const mode = modeById('edo_oimawashi');
  const empty = emptyBoard();
  assert.equal(SugorokuCore.checkWinner(empty, [0, 0], [6, 0], mode), BLACK);
  assert.equal(SugorokuCore.checkWinner(empty, [0, 0], [0, 6], mode), WHITE);
  assert.equal(SugorokuCore.checkWinner(empty, [0, 0], [5, 5], mode), -1);
});

test('Muromachi Muji win requires an enemy bar stone and a full enemy home blockade', () => {
  const mode = modeById('muromachi_buke');

  const winPts = emptyBoard();
  for (let i = 18; i <= 23; i++) winPts[i] = 2;
  winPts[0] = 3;
  winPts[6] = -14;
  const winBar = [0, 1];
  const winOff = [0, 0];

  assert.equal(sumPositive(winPts), mode.stoneCount, 'fixture must contain 15 Black stones');
  assert.equal(
    sumNegativeMagnitude(winPts) + winBar[1],
    mode.stoneCount,
    'fixture must contain 15 White stones including the bar stone'
  );
  assert.equal(SugorokuCore.isMujiWin(winPts, winBar, BLACK), true);
  assert.equal(SugorokuCore.checkWinner(winPts, winBar, winOff, mode), BLACK);

  const negPts = winPts.slice();
  negPts[23] = 1;
  negPts[1] = 1;
  assert.equal(sumPositive(negPts), mode.stoneCount, 'negative fixture must still contain 15 Black stones');
  assert.equal(SugorokuCore.isMujiWin(negPts, winBar, BLACK), false);
  assert.equal(SugorokuCore.checkWinner(negPts, winBar, winOff, mode), -1);
});

// ==================== Oimawashi special mode ====================

group('Oimawashi special mode');

test('Oimawashi capture increments the capturer off count and never uses the bar', () => {
  const mode = modeById('edo_oimawashi');
  const pts = emptyBoard();
  pts[19] = 1;
  pts[16] = -3;
  const bar = [0, 0];
  const off = [0, 0];

  const steps = SugorokuCore.getLegalSteps(pts, bar, off, BLACK, [3], mode, false);
  const step = assertStep(steps, 19, 16, 3);
  assert.equal(step.isLeap, false);

  const next = SugorokuCore.cloneApplyStep(pts, bar, off, BLACK, step, mode);
  assert.equal(next.hit, true);
  assert.equal(next.pts[19], 0);
  assert.equal(next.pts[16], 1);
  assert.deepEqual(next.bar, [0, 0], 'Oimawashi captures go to off, not bar');
  assert.deepEqual(next.off, [3, 0], 'Black capture count increases by the captured stack size');

  // Capture-aware conservation for this partial fixture:
  // Black own stones on board + White captures = initial Black stones.
  // White own stones on board + Black captures = initial White stones.
  assert.equal(sumPositive(next.pts) + next.off[1], 1);
  assert.equal(sumNegativeMagnitude(next.pts) + next.off[0], 3);
});

// ==================== Summary ====================

console.log(`\n${passed} passed, ${failures.length} failed.`);
if (failures.length > 0) {
  console.error('\nTest failures:');
  for (const { name, err } of failures) {
    console.error(`- ${name}`);
    console.error(err.stack || err.message || String(err));
  }
  process.exit(1);
}
console.log('All JS rules tests passed.');
