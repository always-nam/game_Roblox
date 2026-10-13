import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLevel, tilt, status, solve, starsFor, stateKey } from '../../src/engine.js';

const run = (rows, dirs) => {
  const { level, state } = parseLevel(rows);
  let st = state;
  const results = [];
  for (const d of dirs) {
    const r = tilt(level, st, d);
    results.push(r);
    st = r.state;
  }
  return { level, state: st, results };
};
const pos = (st, id) => st.pieces.find((p) => p.id === id);

test('구슬은 벽이나 판 끝까지 굴러간다', () => {
  const { state } = run(['r...#R'], ['right']);
  assert.deepEqual([pos(state, 0).x, pos(state, 0).y], [3, 0]);
  const { state: s2 } = run(['r...#R'], ['left']);
  assert.equal(pos(s2, 0).x, 0);
});

test('원래 상태는 변경되지 않는다 (불변성)', () => {
  const { level, state } = parseLevel(['r...R']);
  tilt(level, state, 'right');
  assert.equal(state.pieces[0].x, 0);
});

test('움직임이 없으면 changed=false', () => {
  const { results } = run(['r...R'], ['left']);
  assert.equal(results[0].changed, false);
  assert.equal(results[0].moves.length, 0);
});

test('같은 색 구멍을 지나가면 빠진다', () => {
  const { state, results } = run(['r.R..'], ['right']);
  assert.equal(pos(state, 0).gone, true);
  assert.equal(results[0].moves[0].end, 'hole');
  assert.equal(status(state), 'won');
});

test('다른 색 구멍은 그냥 지나간다', () => {
  const { state } = run(['rG..', 'g..R'], ['right']);
  assert.equal(pos(state, 0).x, 3);
  assert.ok(!pos(state, 0).gone);
});

test('채워진 구멍은 바닥이 된다', () => {
  // 두 번째 빨간 구슬은 첫 번째가 채운 구멍을 지나 다음 구멍으로 간다
  const { state } = run(['rr.R..R'], ['right']);
  assert.equal(status(state), 'won');
});

test('앞의 구슬이 먼저 움직이고 뒤의 구슬은 그 뒤에 멈춘다', () => {
  const { state } = run(['rb...', 'R...B'], ['right']);
  assert.equal(pos(state, 1).x, 4);
  assert.equal(pos(state, 0).x, 3);
});

test('앞 구슬이 구멍에 빠지면 뒤 구슬은 더 멀리 굴러간다', () => {
  const { state } = run(['br.R.', '....B'], ['right']);
  assert.equal(pos(state, 1).gone, true);
  assert.equal(pos(state, 0).x, 4);
});

test('세로 방향도 올바르게 처리한다', () => {
  const { state } = run(['r', '.', 'R'], ['down']);
  assert.equal(status(state), 'won');
  const { state: s2 } = run(['R', '.', 'r'], ['up']);
  assert.equal(status(s2), 'won');
});

test('구슬이 함정에 빠지면 실패하고 더 이상 움직이지 않는다', () => {
  const { level, state, results } = run(['r.*.R'], ['right']);
  assert.equal(results[0].moves[0].end, 'pit');
  assert.equal(status(state), 'lost');
  assert.equal(tilt(level, state, 'left').changed, false);
});

test('돌은 함정을 메우고, 메운 자리는 바닥이 된다', () => {
  const { state, results } = run(['o.*.R', 'r....'], ['right', 'up', 'right']);
  assert.equal(results[0].moves.find((m) => m.id === 0).end, 'plug');
  assert.equal(status(state), 'won');
});

test('돌은 구멍에 빠지지 않는다', () => {
  const { state } = run(['oR..', 'r.R.'], ['right']);
  assert.equal(pos(state, 0).x, 3);
  assert.ok(!pos(state, 0).gone);
});

test('알 수 없는 문자와 구멍 부족을 거부한다', () => {
  assert.throws(() => parseLevel(['r?R']));
  assert.throws(() => parseLevel(['rr.R']));
  assert.throws(() => parseLevel(['....']));
});

test('짧은 줄은 벽으로 채워진다', () => {
  const { level } = parseLevel(['r..R', '.']);
  assert.equal(level.cells[level.w + 2], '#');
});

test('풀이기는 최단 해를 찾는다', () => {
  const { level, state } = parseLevel(['r..', '...', '..R']);
  const res = solve(level, state);
  assert.equal(res.solvable, true);
  assert.equal(res.moves.length, 2);
});

test('풀 수 없는 퍼즐을 판정한다', () => {
  const { level, state } = parseLevel(['r#R']);
  assert.equal(solve(level, state).solvable, false);
});

test('같은 색 구슬은 상태 키에서 서로 교환 가능하다', () => {
  const a = parseLevel(['r.r.RR']).state;
  const b = parseLevel(['r.r.RR']).state;
  b.pieces.reverse();
  assert.equal(stateKey(a), stateKey(b));
});

test('별 개수 계산', () => {
  assert.equal(starsFor(5, 5), 3);
  assert.equal(starsFor(4, 5), 3);
  assert.equal(starsFor(7, 5), 2);
  assert.equal(starsFor(8, 5), 1);
  assert.equal(starsFor(13, 10), 2);
  assert.equal(starsFor(14, 10), 1);
});

test('색깔 문: 같은 색 구슬은 지나가고, 다른 색 구슬과 돌은 막힌다', () => {
  // 빨간 구슬은 빨간 문(1)을 지나 구멍으로, 파란 구슬은 문 앞에서 멈춘다
  const { state } = run(['r.1.R', 'b.1.B'], ['right']);
  assert.equal(pos(state, 0).gone, true);
  assert.equal(pos(state, 1).x, 1);
  const { state: s2 } = run(['o.3..', 'b...B'], ['right']);
  assert.equal(pos(s2, 0).x, 1);                 // 돌은 문 앞에서 멈춤
});

test('색깔 문 위에 멈출 수 있고, 그 위의 구슬은 다른 조각을 막는다', () => {
  const { state } = run(['r2#R'], ['right']);
  assert.equal(pos(state, 0).x, 0);              // 빨간 구슬: 초록 문(2)은 벽
  const g = run(['g2#G', 'b...B'], ['right']).state;
  assert.equal(pos(g, 0).x, 1);                  // 초록 구슬: 문 위로 올라가 벽 앞에서 멈춤
});
