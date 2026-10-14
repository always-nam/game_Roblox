// 공방 1000단계 검증 — 사람이 1000판을 다 풀어 볼 수 없으므로 기계가 모든 판을 확인한다.
//   1) 저장된 풀이를 실제 게임 규칙으로 재생하면 반드시 성공한다 (풀 수 있다)
//   2) 그보다 짧은 풀이가 없다 (표시되는 '최소 수'가 정확하다 → 별 3개 기준이 맞다)
//   3) 난이도 곡선·새 장애물 등장 순서·중복이 계획대로다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORKSHOP, WORKSHOP_BOX } from '../../src/workshop.js';
import { LEVELS } from '../../src/levels.js';
import { parseLevel, solve, tilt, status } from '../../src/engine.js';

const BOXES = WORKSHOP.length / WORKSHOP_BOX;
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const box = (b) => WORKSHOP.slice(b * WORKSHOP_BOX, (b + 1) * WORKSHOP_BOX);
const hasIn = (lv, re) => lv.rows.some((r) => re.test(r));

test('공방은 1000단계(상자 20개 × 50판)이고 id와 판이 겹치지 않는다', () => {
  assert.equal(WORKSHOP.length, 1000);
  assert.equal(BOXES, 20);
  WORKSHOP.forEach((lv, i) => assert.equal(lv.id, `W${i + 1}`));
  assert.equal(new Set(WORKSHOP.map((l) => l.rows.join('/'))).size, 1000, '같은 판이 두 번 나오면 안 됨');
  const story = new Set(LEVELS.map((l) => l.rows.join('/')));
  assert.ok(WORKSHOP.every((l) => !story.has(l.rows.join('/'))), '이야기 모드 판과 겹치면 안 됨');
});

test('1000판 모두: 저장된 풀이를 재생하면 성공하고, 풀이 길이가 최소 수와 같다', () => {
  const bad = [];
  for (const lv of WORKSHOP) {
    const { level, state } = parseLevel(lv.rows);
    assert.ok(lv.rows.every((r) => r.length === level.w), `${lv.id}: 줄 길이`);
    let st = state;
    for (const d of lv.solution) {
      const r = tilt(level, st, d);
      if (!r.changed || status(r.state) === 'lost') { bad.push(`${lv.id}: 풀이 중 ${d}가 막히거나 함정`); break; }
      st = r.state;
    }
    if (status(st) !== 'won') bad.push(`${lv.id}: 풀이를 끝까지 해도 성공하지 않음`);
    if (lv.solution.length !== lv.par) bad.push(`${lv.id}: 풀이 ${lv.solution.length}수 ≠ 최소 ${lv.par}수`);
  }
  assert.deepEqual(bad, []);
});

test('1000판 모두: 최소 수보다 짧은 풀이가 없다(풀이기로 전부 탐색)', () => {
  const bad = [];
  for (const lv of WORKSHOP) {
    const { level, state } = parseLevel(lv.rows);
    // par-1수까지 모든 경우를 탐색(노드 한도를 넘지 않았어야 '전부 봤다'고 말할 수 있다)
    const LIMIT = 2_000_000;
    const r = solve(level, state, { maxDepth: lv.par - 1, maxNodes: LIMIT });
    if (r.solvable === true) bad.push(`${lv.id}: ${r.moves.length}수 풀이가 있음`);
    else if (r.explored > LIMIT) bad.push(`${lv.id}: 탐색 한도 초과(다 확인 못 함)`);
  }
  assert.deepEqual(bad, []);
});

test('난이도: 첫 상자는 쉽고(최소 2~5수), 마지막 상자가 가장 어렵다', () => {
  const pars = (b) => box(b).map((l) => l.par);
  assert.ok(pars(0).every((p) => p >= 2 && p <= 5), `1번 상자: ${pars(0)}`);
  assert.ok(box(0).slice(0, 10).every((l) => l.par <= 3), '첫 10판은 3수 이하');
  const avgs = Array.from({ length: BOXES }, (_, b) => avg(pars(b)));
  assert.equal(Math.max(...avgs), avgs[BOXES - 1], `상자별 평균: ${avgs.map((a) => a.toFixed(1))}`);
  // 큰 흐름은 오른다: 5상자씩 묶은 평균이 계속 커진다
  const q = [0, 1, 2, 3].map((k) => avg(avgs.slice(k * 5, k * 5 + 5)));
  for (let k = 1; k < 4; k++) assert.ok(q[k] > q[k - 1], `구간 평균 ${q.map((x) => x.toFixed(1))}`);
});

test('난이도: 상자 안에서는 뒤쪽 판이 앞쪽 판보다 평균적으로 어렵다', () => {
  for (let b = 0; b < BOXES; b++) {
    const p = box(b).map((l) => l.par);
    assert.ok(avg(p.slice(25)) > avg(p.slice(0, 25)), `${b + 1}번 상자`);
  }
});

test('새 장애물은 정해진 상자부터 나온다(돌 3번·함정 6번·색깔 문 13번 상자부터)', () => {
  WORKSHOP.forEach((lv, i) => {
    const b = Math.floor(i / WORKSHOP_BOX);
    if (hasIn(lv, /o/)) assert.ok(b >= 2, `${lv.id} 돌`);
    if (hasIn(lv, /\*/)) assert.ok(b >= 5, `${lv.id} 함정`);
    if (hasIn(lv, /[1-4]/)) assert.ok(b >= 12, `${lv.id} 색깔 문`);
  });
  // 처음 나오는 상자에서는 실제로 여러 번 나온다(소개만 하고 사라지지 않음)
  assert.ok(box(2).filter((l) => hasIn(l, /o/)).length >= 10);
  assert.ok(box(5).filter((l) => hasIn(l, /\*/)).length >= 10);
  assert.ok(box(12).every((l) => hasIn(l, /[1-4]/)));
});

test('색깔 문이 있는 판은 문이 실제로 퍼즐에 영향을 준다(문을 지우면 더 짧게 풀림)', () => {
  const bad = [];
  for (const lv of WORKSHOP.filter((l) => hasIn(l, /[1-4]/))) {
    const alt = parseLevel(lv.rows.map((s) => s.replace(/[1-4]/g, '.')));
    const r = solve(alt.level, alt.state, { maxDepth: lv.par, maxNodes: 2_000_000 });
    if (!(r.solvable === true && r.moves.length < lv.par)) bad.push(lv.id);
  }
  assert.deepEqual(bad, []);
});
