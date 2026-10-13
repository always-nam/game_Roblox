import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePuzzle, mulberry32, dateSeed } from '../../src/generator.js';
import { parseLevel, solve, tilt, status } from '../../src/engine.js';

test('난수 생성기는 시드가 같으면 같은 수열을 만든다', () => {
  const a = mulberry32(42), b = mulberry32(42);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});

test('날짜 시드', () => {
  assert.equal(dateSeed(new Date(2026, 9, 13)), 20261013);
});

test('같은 시드는 같은 퍼즐을 만든다', () => {
  assert.deepEqual(generatePuzzle(20261013).rows, generatePuzzle(20261013).rows);
});

test('30일치 오늘의 퍼즐이 모두 풀 수 있고 par가 범위 안이다', () => {
  for (let d = 1; d <= 30; d++) {
    const p = generatePuzzle(20261100 + d);
    assert.ok(p, `시드 ${d} 생성 실패`);
    assert.ok(p.par >= 6 && p.par <= 14, `par ${p.par}`);
    const { level, state } = parseLevel(p.rows);
    let st = state;
    for (const dir of p.solution) st = tilt(level, st, dir).state;
    assert.equal(status(st), 'won');
    assert.equal(solve(level, state, { maxDepth: 14 }).moves.length, p.par);
  }
});
