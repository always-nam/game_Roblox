import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../../src/levels.js';
import { parseLevel, solve, tilt, status } from '../../src/engine.js';

test('레벨이 32개(4장 × 8단계)이고 이름이 겹치지 않는다', () => {
  assert.equal(LEVELS.length, 32);
  assert.equal(new Set(LEVELS.map((l) => l.name)).size, LEVELS.length);
});

LEVELS.forEach((lv, i) => {
  test(`레벨 ${i + 1} "${lv.name}": 풀 수 있고 최소 이동 수가 par(${lv.par})와 같다`, () => {
    const { level, state } = parseLevel(lv.rows);
    assert.ok(lv.rows.every((r) => r.length === level.w), '모든 줄의 길이가 같아야 함');
    const res = solve(level, state, { maxDepth: 40, maxNodes: 500000 });
    assert.equal(res.solvable, true);
    assert.equal(res.moves.length, lv.par);
    // 풀이를 실제로 재생하면 승리해야 한다
    let st = state;
    for (const d of res.moves) st = tilt(level, st, d).state;
    assert.equal(status(st), 'won');
  });
});

test('par는 대체로 증가한다 (난이도 곡선)', () => {
  const pars = LEVELS.map((l) => l.par);
  assert.ok(pars[pars.length - 1] >= Math.max(...pars.slice(0, 6)) * 2);
});

test('4장(25~32단계)에는 색깔 문이 있고, 그 전에는 없다', () => {
  LEVELS.forEach((lv, i) => {
    const hasGate = lv.rows.some((r) => /[1-4]/.test(r));
    assert.equal(hasGate, i >= 24, `${i + 1}단계 ${lv.name}`);
  });
});
