import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../../src/levels.js';
import { parseLevel, solve, tilt, status } from '../../src/engine.js';

test('레벨이 48개(4장 × 12단계)이고 이름·id가 겹치지 않는다', () => {
  assert.equal(LEVELS.length, 48);
  assert.equal(new Set(LEVELS.map((l) => l.id)).size, LEVELS.length);
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

test('색깔 문은 4장(37단계 이후)에만 나온다', () => {
  LEVELS.forEach((lv, i) => {
    const hasGate = lv.rows.some((r) => /[1-4]/.test(r));
    if (hasGate) assert.ok(i >= 36, `${i + 1}단계 ${lv.name}`);
  });
});

test('[요청] 기울이기에 익숙해지도록 천천히 어려워진다', () => {
  const pars = LEVELS.map((l) => l.par);
  assert.ok(pars.slice(0, 6).every((p) => p <= 2), `처음 6단계: ${pars.slice(0, 6)}`);
  assert.ok(pars.slice(0, 12).every((p) => p <= 5), `1장: ${pars.slice(0, 12)}`);
  assert.ok(pars.slice(12, 24).every((p) => p <= 9), `2장: ${pars.slice(12, 24)}`);
  // 장 안에서는 앞쪽 절반보다 뒤쪽 절반이 평균적으로 어렵다
  for (let c = 0; c < 4; c++) {
    const ch = pars.slice(c * 12, c * 12 + 12);
    const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    assert.ok(avg(ch.slice(6)) > avg(ch.slice(0, 6)), `${c + 1}장`);
  }
});

test('처음 기울이기 연습 단계에는 길잡이 화살표가 켜져 있다', () => {
  assert.ok(LEVELS.slice(0, 4).every((l) => l.guide));
});

test('이전 버전 단계(L1~L32)가 모두 남아 있어 이전 기록을 옮길 수 있다', () => {
  for (let i = 1; i <= 32; i++) assert.ok(LEVELS.some((l) => l.id === `L${i}`), `L${i}`);
});
