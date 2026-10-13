import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  eulerToMatrix, matrixToEuler, mul, axisRotation, tiltIntent, toScreen, dominant,
  createTiltDetector, SENSITIVITY,
} from '../../src/motion.js';

const close = (a, b, eps = 0.5) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

// 자세 만들기: 앞뒤로 pitch°만큼 든 휴대폰(alpha는 임의 방향) → 기기 축으로 추가 회전
const posture = (pitch, alpha = 30) => eulerToMatrix(alpha, pitch, 0);
const turn = (R, axis, deg) => mul(R, axisRotation(axis, deg));
const euler = (R) => matrixToEuler(R);   // [alpha, beta, gamma]

/** 감지기에 한 자세를 ms 동안 60Hz로 넣는다. 나온 방향들을 돌려준다 */
function hold(det, R, ms, clock, angle = 0) {
  const [a, b, g] = euler(R);
  const dirs = [];
  for (let t = 0; t < ms; t += 16) {
    clock.t += 16;
    const r = det.feed(b, g, angle, a, clock.t);
    if (r.dir) dirs.push(r.dir);
  }
  return dirs;
}
function ready(det, R, clock, angle = 0) {
  hold(det, R, 400, clock, angle);
  assert.equal(det.state, 'armed');
}

test('각도 ↔ 행렬 변환이 서로 맞는다', () => {
  for (const [a, b, g] of [[0, 0, 0], [30, 40, 10], [200, -20, -60], [90, 85, 5]]) {
    const [a2, b2, g2] = matrixToEuler(eulerToMatrix(a, b, g));
    close(a2, a, 1e-6); close(b2, b, 1e-6); close(g2, g, 1e-6);
  }
});

test('화면 회전에 따라 화면 기준 방향으로 바뀐다', () => {
  assert.equal(dominant(toScreen(20, 0, 0)).dir, 'right');
  assert.equal(dominant(toScreen(0, 20, 0)).dir, 'down');
  assert.equal(dominant(toScreen(0, 20, 90)).dir, 'right');
  assert.equal(dominant(toScreen(20, 0, 90)).dir, 'up');
  assert.equal(dominant(toScreen(0, 20, 270)).dir, 'left');
  assert.equal(dominant(toScreen(20, 0, 180)).dir, 'left');
  assert.equal(dominant(toScreen(0, 20, -90)).dir, 'left');
});

test('[실기기 사례] 63°로 든 상태에서 쟁반처럼 15° 오른쪽으로 기울이면 15°로 잡힌다', () => {
  const base = posture(63);
  const d = tiltIntent(base, turn(base, 'y', 15));
  close(d.x, 15, 0.3);
  close(d.y, 0, 0.3);
});

test('어떤 자세로 들든 네 방향의 크기가 같게 잡힌다 (대각선 치우침 없음)', () => {
  for (const p of [0, 30, 63, 85]) {
    const base = posture(p);
    const r = tiltIntent(base, turn(base, 'y', 15));
    const l = tiltIntent(base, turn(base, 'y', -15));
    const dn = tiltIntent(base, turn(base, 'x', 15));
    const u = tiltIntent(base, turn(base, 'x', -15));
    close(r.x, 15, 0.3); close(l.x, -15, 0.3); close(dn.y, 15, 0.3); close(u.y, -15, 0.3);
    for (const v of [r.y, l.y, dn.x, u.x]) close(v, 0, 0.3);
  }
});

test('세워 든 상태에서 핸들처럼 돌려도 좌우로 잡힌다', () => {
  const base = posture(88);
  assert.equal(dominant(tiltIntent(base, turn(base, 'z', -15))).dir, 'right');   // 시계 방향
  assert.equal(dominant(tiltIntent(base, turn(base, 'z', 15))).dir, 'left');
  // 바닥에 눕힌 상태에서 빙글 돌리는 것은 기울기가 아니다
  const flat = posture(0);
  close(tiltIntent(flat, turn(flat, 'z', 30)).x, 0, 0.5);
});

test('가로로 든 상태(화면 90°)에서 핸들 돌리기는 화면 기준 좌우가 된다', () => {
  // 화면 90°: 기기 윗변이 화면 왼쪽 → 기기 오른쪽(+x)이 화면 위. 그 상태로 세워 듦
  const base = mul(eulerToMatrix(0, 0, -80), axisRotation('z', 0));
  const up = base[2];
  assert.ok(up[0] > 0.9, `기기 +x가 위를 향함 ${up}`);
  assert.equal(dominant(tiltIntent(base, turn(base, 'z', -15), 90)).dir, 'right');
  assert.equal(dominant(tiltIntent(base, turn(base, 'z', 15), 90)).dir, 'left');
});

test('세로를 지나 젖혀도 아래로 잡힌다', () => {
  const base = posture(82);
  const d = tiltIntent(base, turn(base, 'x', 16));
  assert.equal(dominant(d).dir, 'down');
  close(d.y, 16, 0.3);
});

test('같은 자세를 다른 각도 표현으로 받아도 결과가 같다', () => {
  const base = posture(70);
  const R = turn(base, 'x', 25);                // 세로를 지난 자세
  const [a, b, g] = euler(R);
  const alt = eulerToMatrix(a + 180, 180 - b, g > 0 ? g - 180 : g + 180);
  const d1 = tiltIntent(base, R), d2 = tiltIntent(base, alt);
  close(d1.x, d2.x, 1e-6); close(d1.y, d2.y, 1e-6);
});

test('[실기기 사례] 버튼을 누르는 순간 흔들려도 그 자세를 기준으로 삼지 않는다', () => {
  const det = createTiltDetector();
  const clock = { t: 0 };
  const jolt = turn(posture(40), 'y', 28);       // 누르는 순간 오른쪽으로 28° 출렁
  const natural = posture(63);
  hold(det, jolt, 60, clock);                    // 잠깐(60ms)
  assert.equal(det.state, 'calib');
  assert.deepEqual(hold(det, natural, 400, clock), []);   // 멈추면 그 자세가 기준
  assert.equal(det.state, 'armed');
  assert.deepEqual(hold(det, turn(natural, 'y', 14), 50, clock), ['right']);
});

test('기울였다 돌아오면 다시 입력을 받고, 네 방향 모두 동작한다', () => {
  const det = createTiltDetector();
  const clock = { t: 0 };
  const base = posture(63);
  ready(det, base, clock);
  for (const [axis, deg, want] of [['x', 15, 'down'], ['x', -15, 'up'], ['y', 15, 'right'], ['y', -15, 'left']]) {
    assert.deepEqual(hold(det, turn(base, axis, deg), 100, clock), [want], want);
    assert.deepEqual(hold(det, base, 150, clock), []);
    assert.equal(det.state, 'armed');
  }
});

test('기울인 채 있으면 한 번만 입력된다', () => {
  const det = createTiltDetector();
  const clock = { t: 0 };
  const base = posture(50);
  ready(det, base, clock);
  assert.deepEqual(hold(det, turn(base, 'y', 20), 1000, clock), ['right']);
});

test('기울인 채 오래 멈추면 그 자세가 새 기준이 되고, 돌아오는 동작은 입력으로 치지 않는다', () => {
  const det = createTiltDetector();
  const clock = { t: 0 };
  const base = posture(50);
  ready(det, base, clock);
  const tilted = turn(base, 'y', 20);
  assert.deepEqual(hold(det, tilted, 1500, clock), ['right']);
  assert.equal(det.state, 'armed');
  assert.deepEqual(hold(det, base, 1000, clock), []);         // 원래 자세로 복귀: 왼쪽 입력 없음
  assert.deepEqual(hold(det, turn(base, 'y', -15), 100, clock), ['left']);   // 그다음 진짜 왼쪽
});

test('기준 근처에서 멈추면 기준이 지금 자세로 다시 맞춰진다', () => {
  const det = createTiltDetector();
  const clock = { t: 0 };
  const base = posture(40);
  ready(det, base, clock);
  const drifted = turn(base, 'x', 8);                         // 8° 숙인 채로 편하게 들고 있음
  hold(det, drifted, 900, clock);
  assert.deepEqual(hold(det, turn(drifted, 'x', -12), 50, clock), ['up']);   // 새 기준에서 12°
});

test('감도: 둔하게 18° · 보통 12° · 민감 8°', () => {
  for (const [level, deg] of Object.entries(SENSITIVITY)) {
    const det = createTiltDetector({ on: deg });
    const clock = { t: 0 };
    const base = posture(45);
    ready(det, base, clock);
    assert.deepEqual(hold(det, turn(base, 'y', deg - 1.5), 50, clock), [], `${level} 미만`);
    hold(det, base, 100, clock);
    assert.deepEqual(hold(det, turn(base, 'y', deg + 1), 50, clock), ['right'], `${level} 이상`);
  }
});

test('나침반 값(alpha)이 없어도 앞뒤·좌우가 동작한다', () => {
  const det = createTiltDetector();
  let t = 0;
  for (let i = 0; i < 30; i++) det.feed(45, 0, 0, null, (t += 16));
  assert.equal(det.state, 'armed');
  assert.equal(det.feed(45, 16, 0, null, (t += 16)).dir, 'right');
});

test('잘못된 값은 무시하고, 화면이 회전하면 기준을 다시 잡는다', () => {
  const det = createTiltDetector();
  const clock = { t: 0 };
  ready(det, posture(30), clock);
  assert.equal(det.feed(null, 5).dir, null);
  assert.equal(det.feed(NaN, 5).dir, null);
  hold(det, posture(30), 50, clock, 90);
  assert.equal(det.state, 'calib');
});
