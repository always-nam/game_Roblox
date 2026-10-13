import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollDuration, rollKeyframes, ROLL } from '../../src/anim.js';
import { createFlowGate } from '../../src/motion.js';

test('[요청] 이전 속도의 약 절반: 굴러가는 시간이 약 2배', () => {
  const before = (n) => 70 + 55 * n;              // 이전 버전의 이동 시간(ms)
  const ratios = [1, 2, 3, 4, 5, 6].map((n) => rollDuration(n) / before(n));
  const avg = ratios.reduce((a, b) => a + b) / ratios.length;
  assert.ok(avg >= 1.8 && avg <= 2.6, `평균 ${avg.toFixed(2)}배 (${ratios.map((r) => r.toFixed(2)).join(', ')})`);
});

test('실제 공처럼: 걸리는 시간은 거리의 제곱근에 비례(등가속)', () => {
  const travel = (n) => rollDuration(n, { bounce: false }) - ROLL.base;
  assert.ok(Math.abs(travel(4) / travel(1) - 2) < 0.02);
  assert.ok(Math.abs(travel(9) / travel(1) - 3) < 0.02);
  assert.equal(rollDuration(0), 0);
});

test('벽에 멈출 때: 부딪힘(찌그러짐) → 살짝 튕김 → 제자리', () => {
  const k = rollKeyframes({ from: { x: 0, y: 1 }, to: { x: 3, y: 1 }, cell: 50 });
  assert.equal(k.frames.length, 4);
  assert.match(k.frames[0].transform, /translate\(0\.00px, 50\.00px\)/);
  assert.match(k.frames[1].transform, /translate\(150\.00px, 50\.00px\) scale\(0\.88, 1\.06\)/);
  assert.match(k.frames[2].transform, /translate\(144\.00px, 50\.00px\)/);   // 0.12칸 튕김
  assert.match(k.frames[3].transform, /translate\(150\.00px, 50\.00px\) scale\(1, 1\)/);
  assert.ok(k.frames.every((f, i, a) => i === 0 || f.offset > a[i - 1].offset));
});

test('구슬 무늬는 굴러간 거리만큼 진행 방향으로 돈다 (누적)', () => {
  const k = rollKeyframes({ from: { x: 2, y: 4 }, to: { x: 2, y: 0 }, cell: 40, skin: { x: 10, y: 5 } });
  assert.deepEqual(k.skinEnd, { x: 10, y: 5 - 160 });
  assert.equal(k.skinFrames[0].backgroundPosition, '10.0px 5.0px');
  assert.equal(k.skinFrames[3].backgroundPosition, '10.0px -155.0px');
});

test('구멍·함정으로 갈 때는 튕기지 않고 그대로 들어간다', () => {
  const k = rollKeyframes({ from: { x: 0, y: 0 }, to: { x: 0, y: 2 }, cell: 50, end: 'hole' });
  assert.equal(k.frames.length, 2);
  assert.equal(k.duration, rollDuration(2, { bounce: false }));
});

test('돌은 무늬가 없고 덜 튕긴다', () => {
  const k = rollKeyframes({ from: { x: 0, y: 0 }, to: { x: 2, y: 0 }, cell: 50, kind: 'stone' });
  assert.equal(k.skinFrames, null);
  assert.match(k.frames[2].transform, /translate\(97\.60px/);
});

test('흐름 조절: 같은 방향으로 잠깐 기울어 있어야 하고, 앞 움직임이 끝나고 쉬었다가 움직인다', () => {
  const g = createFlowGate({ dwell: 140, gap: 260 });
  assert.equal(g.decide(['down'], 0), null);          // 막 기울임
  assert.equal(g.decide(['down'], 100), null);        // 아직 140ms 안 됨
  assert.equal(g.decide(['down'], 150), 'down');
  // 앞 움직임이 t=1000에 끝남
  assert.equal(g.decide(['right'], 1000, 1000), null);
  assert.equal(g.decide(['right'], 1200, 1000), null);   // 쉬는 시간 260ms 전
  assert.equal(g.decide(['right'], 1270, 1000), 'right');
  // 방향이 바뀌면 다시 기다린다
  assert.equal(g.decide(['up'], 2000, 0), null);
  assert.equal(g.decide(['left'], 2100, 0), null);
  assert.equal(g.decide(['left'], 2200, 0), null);
  assert.equal(g.decide(['left'], 2250, 0), 'left');
  assert.equal(g.decide([], 3000, 0), null);
});
