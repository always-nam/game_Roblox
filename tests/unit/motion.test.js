import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  eulerToMatrix, matrixToEuler, mul, axisRotation, absoluteTilt, toScreen, dominant,
  createTiltDetector, SENSITIVITY, activeDirs, nextDirs, createFlowGate,
} from '../../src/motion.js';

const close = (a, b, eps = 0.5) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

// 자세 만들기: 앞뒤로 pitch°만큼 든 휴대폰(alpha는 아무 방향) → 기기 축으로 추가 회전
const posture = (pitch, alpha = 30) => eulerToMatrix(alpha, pitch, 0);
const turn = (R, axis, deg) => mul(R, axisRotation(axis, deg));
const tiltOf = (R, angle = 0) => { const [, b, g] = matrixToEuler(R); return absoluteTilt(b, g, angle); };

/** 감지기에 한 자세를 ms 동안 60Hz로 넣고 마지막 결과를 돌려준다 */
function hold(det, R, ms, clock, angle = 0) {
  const [, b, g] = matrixToEuler(R);
  let r;
  for (let t = 0; t < ms; t += 16) { clock.t += 16; r = det.feed(b, g, angle, clock.t); }
  return r;
}

test('각도 ↔ 행렬 변환이 서로 맞는다', () => {
  for (const [a, b, g] of [[0, 0, 0], [30, 40, 10], [200, -20, -60], [90, 85, 5]]) {
    const [a2, b2, g2] = matrixToEuler(eulerToMatrix(a, b, g));
    close(a2, a, 1e-6); close(b2, b, 1e-6); close(g2, g, 1e-6);
  }
});

test('화면 회전에 따라 화면 기준 방향으로 바뀐다', () => {
  assert.equal(dominant(toScreen(20, 0, 0)).dir, 'right');
  assert.equal(dominant(toScreen(0, 20, 90)).dir, 'right');
  assert.equal(dominant(toScreen(20, 0, 90)).dir, 'up');
  assert.equal(dominant(toScreen(0, 20, 270)).dir, 'left');
  assert.equal(dominant(toScreen(20, 0, 180)).dir, 'left');
});

test('[요청] 좌우 원점은 실제 수평: 어느 자세에서 시작해도 오른쪽으로 기울어 있으면 오른쪽', () => {
  close(tiltOf(posture(0)).side, 0);
  close(tiltOf(posture(63)).side, 0);
  close(tiltOf(turn(posture(0), 'y', 20)).side, 20);
  close(tiltOf(turn(posture(45), 'y', -20)).side, -20);
});

test('[실기기 사례] 63°로 든 상태에서 쟁반처럼 15° 기울이면 15°로 잡힌다', () => {
  close(tiltOf(turn(posture(63), 'y', 15)).side, 15, 0.3);
});

test('앞뒤 각도는 세로를 지나도 끊기지 않는다', () => {
  const vals = [60, 80, 89, 91, 100, 110].map((p) => tiltOf(posture(p)).pitch);
  vals.forEach((v, i) => i && assert.ok(v > vals[i - 1], vals.join(',')));
  close(tiltOf(posture(100)).pitch, 100);
});

test('거의 세워 든 상태에서는 핸들처럼 돌리면 좌우로 잡힌다', () => {
  for (const p of [80, 85, 89]) {
    assert.ok(tiltOf(turn(posture(p), 'z', -16)).side > 12, `${p}° 시계 방향 → 오른쪽`);
    assert.ok(tiltOf(turn(posture(p), 'z', 16)).side < -12, `${p}° 반시계 → 왼쪽`);
  }
});

test('같은 자세를 다른 각도 표현으로 받아도 결과가 같다', () => {
  const R = turn(posture(70), 'x', 25);
  const [a, b, g] = matrixToEuler(R);
  const alt = absoluteTilt(180 - b, g > 0 ? g - 180 : g + 180, 0);
  const ref = absoluteTilt(b, g, 0);
  close(alt.side, ref.side, 1e-6); close(alt.pitch, ref.pitch, 1e-6);
});

test('원점이 없으면 멈췄을 때 앞뒤 원점을 잡는다 — 버튼 누를 때의 흔들림은 무시', () => {
  const det = createTiltDetector();
  const clock = { t: 0 };
  hold(det, turn(posture(40), 'x', 25), 60, clock);     // 누르는 순간 출렁
  assert.equal(det.state, 'calib');
  const r = hold(det, posture(63), 400, clock);
  assert.equal(det.state, 'ready');
  close(det.origin.pitch, 63, 0.5);
  assert.deepEqual(hold(det, turn(posture(63), 'x', 14), 50, clock).dirs, ['down']);
  assert.ok(r.origin === null || r.origin.pitch > 62);   // 잡은 순간에만 origin을 알려 준다
});

test('[요청] 저장된 원점이 있으면 기운 채 시작해도 원점이 그대로라 그쪽으로 흐른다', () => {
  const det = createTiltDetector({ origin: { pitch: 50, angle: 0 } });
  assert.equal(det.state, 'ready');
  const clock = { t: 0 };
  // 오른쪽으로 18° 기운 채 시작 → 바로 오른쪽
  assert.deepEqual(hold(det, turn(posture(50), 'y', 18), 50, clock).dirs, ['right']);
  // 앞으로 16° 젖힌 채 시작 → 바로 아래
  const det2 = createTiltDetector({ origin: { pitch: 50, angle: 0 } });
  assert.deepEqual(hold(det2, posture(66), 50, clock).dirs, ['down']);
});

test('네 방향 모두 기울인 동안 계속 그 방향으로 잡힌다', () => {
  const det = createTiltDetector({ origin: { pitch: 63, angle: 0 } });
  const clock = { t: 0 };
  const base = posture(63);
  for (const [axis, deg, want] of [['x', 15, 'down'], ['x', -15, 'up'], ['y', 15, 'right'], ['y', -15, 'left']]) {
    assert.deepEqual(hold(det, turn(base, axis, deg), 1500, clock).dirs, [want], want);
  }
});

test('대각선으로 기울이면 두 방향이 모두 잡힌다 (센 쪽부터)', () => {
  const det = createTiltDetector({ origin: { pitch: 50, angle: 0 } });
  const clock = { t: 0 };
  const diag = turn(turn(posture(50), 'x', 11), 'y', 8);
  assert.deepEqual(hold(det, diag, 100, clock).dirs, ['down', 'right']);
});

test('대각선 판정: 전체 크기가 기준을 넘고, 성분이 그 절반 이상이면 그 방향도 포함', () => {
  assert.deepEqual(activeDirs({ x: 9, y: 9 }, 12), ['right', 'down']);
  assert.deepEqual(activeDirs({ x: -14, y: 4 }, 12), ['left']);
  assert.deepEqual(activeDirs({ x: 6, y: 6 }, 12), []);
  assert.deepEqual(activeDirs({ x: 0, y: -20 }, 12), ['up']);
});

test('정중앙으로 돌아오지 않아도 다른 방향으로 옮기면 그 방향이 다음 후보가 된다', () => {
  assert.deepEqual(nextDirs({ x: 3, y: 15 }, 'down', 12), []);
  assert.deepEqual(nextDirs({ x: 10, y: 12 }, 'down', 12), ['right']);
  assert.deepEqual(nextDirs({ x: 15, y: 2 }, 'right', 12), []);
  assert.deepEqual(nextDirs({ x: 10, y: 12 }, null, 12), ['down', 'right']);
});

test('감도: 둔하게 18° · 보통 12° · 민감 8°', () => {
  for (const [level, deg] of Object.entries(SENSITIVITY)) {
    const det = createTiltDetector({ on: deg, origin: { pitch: 45, angle: 0 } });
    const clock = { t: 0 };
    assert.deepEqual(hold(det, turn(posture(45), 'y', deg - 1.5), 50, clock).dirs, [], `${level} 미만`);
    assert.deepEqual(hold(det, turn(posture(45), 'y', deg + 1), 50, clock).dirs, ['right'], `${level} 이상`);
  }
});

test('calibrate()로 원점을 다시 잡을 수 있다', () => {
  const det = createTiltDetector({ origin: { pitch: 30, angle: 0 } });
  const clock = { t: 0 };
  det.calibrate();
  assert.equal(det.state, 'calib');
  hold(det, posture(55), 400, clock);
  close(det.origin.pitch, 55, 0.5);
  assert.deepEqual(hold(det, posture(60), 50, clock).dirs, []);   // 새 원점에서 5°
});

test('잘못된 값은 무시하고, 화면이 회전하면 앞뒤 원점을 다시 잡는다', () => {
  const det = createTiltDetector({ origin: { pitch: 30, angle: 0 } });
  const clock = { t: 0 };
  assert.deepEqual(det.feed(null, 5).dirs, []);
  assert.deepEqual(det.feed(NaN, 5).dirs, []);
  hold(det, posture(30), 50, clock, 90);
  assert.equal(det.state, 'calib');
});

test('흐름 조절: 같은 방향으로 잠깐 기울어 있어야 하고, 앞 움직임이 끝나고 쉬었다가 움직인다', () => {
  const g = createFlowGate({ dwell: 140, gap: 260 });
  assert.equal(g.decide(['down'], 0), null);
  assert.equal(g.decide(['down'], 150), 'down');
  assert.equal(g.decide(['right'], 1000, 1000), null);
  assert.equal(g.decide(['right'], 1270, 1000), 'right');
});
