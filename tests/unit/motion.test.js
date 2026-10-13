import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  eulerToMatrix, matrixToEuler, mul, axisRotation, tiltIntent, toScreen, dominant,
  createTiltDetector, SENSITIVITY, activeDirs, nextDirs,
} from '../../src/motion.js';

const close = (a, b, eps = 0.5) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

// 자세 만들기: 앞뒤로 pitch°만큼 든 휴대폰(alpha는 임의 방향) → 기기 축으로 추가 회전
const posture = (pitch, alpha = 30) => eulerToMatrix(alpha, pitch, 0);
const turn = (R, axis, deg) => mul(R, axisRotation(axis, deg));
const euler = (R) => matrixToEuler(R);   // [alpha, beta, gamma]

/** 감지기에 한 자세를 ms 동안 60Hz로 넣고, 마지막 결과의 기울어진 방향들을 돌려준다 */
function hold(det, R, ms, clock, angle = 0) {
  const [a, b, g] = euler(R);
  let r;
  for (let t = 0; t < ms; t += 16) {
    clock.t += 16;
    r = det.feed(b, g, angle, a, clock.t);
  }
  return r.dirs;
}
function ready(det, R, clock, angle = 0) {
  hold(det, R, 400, clock, angle);
  assert.equal(det.state, 'ready');
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
  assert.equal(det.state, 'ready');
  assert.deepEqual(hold(det, turn(natural, 'y', 14), 50, clock), ['right']);
});

test('네 방향 모두 기울인 동안 계속 그 방향으로 잡힌다', () => {
  const det = createTiltDetector();
  const clock = { t: 0 };
  const base = posture(63);
  ready(det, base, clock);
  for (const [axis, deg, want] of [['x', 15, 'down'], ['x', -15, 'up'], ['y', 15, 'right'], ['y', -15, 'left']]) {
    assert.deepEqual(hold(det, turn(base, axis, deg), 1500, clock), [want], want);   // 오래 기울여도 유지
  }
});

test('[요청] 대각선으로 기울이면 두 방향이 모두 잡힌다 (센 쪽부터)', () => {
  const det = createTiltDetector();
  const clock = { t: 0 };
  const base = posture(50);
  ready(det, base, clock);
  // 아래로 11°, 오른쪽으로 8°: 각 방향은 12°에 못 미치지만 합친 기울기가 넘으므로 둘 다 인정
  const diag = turn(turn(base, 'x', 11), 'y', 8);
  assert.deepEqual(hold(det, diag, 100, clock), ['down', 'right']);
});

test('대각선 판정: 전체 크기가 기준을 넘고, 성분이 그 절반 이상이면 그 방향도 포함', () => {
  assert.deepEqual(activeDirs({ x: 9, y: 9 }, 12), ['right', 'down']);      // 45°: 둘 다
  assert.deepEqual(activeDirs({ x: -14, y: 4 }, 12), ['left']);            // 거의 왼쪽: 한 방향
  assert.deepEqual(activeDirs({ x: 6, y: 6 }, 12), []);                    // 전체 8.5° < 12°
  assert.deepEqual(activeDirs({ x: 0, y: -20 }, 12), ['up']);
});

test('[요청] 정중앙으로 돌아오지 않아도 다른 방향으로 옮기면 그 방향이 다음 후보가 된다', () => {
  // 아래를 적용한 뒤(last=down) 그대로 오른쪽으로 옮겨 대각선을 거치는 경우
  assert.deepEqual(nextDirs({ x: 3, y: 15 }, 'down', 12), []);              // 아직 아래만: 이미 적용됨
  assert.deepEqual(nextDirs({ x: 10, y: 12 }, 'down', 12), ['right']);      // 대각선 구간: 오른쪽
  assert.deepEqual(nextDirs({ x: 15, y: 2 }, 'down', 12), ['right']);
  assert.deepEqual(nextDirs({ x: 15, y: 2 }, 'right', 12), []);
  assert.deepEqual(nextDirs({ x: 10, y: 12 }, null, 12), ['down', 'right']);
});

test('기준 근처에서 멈추면 기준이 지금 자세로 다시 맞춰지고, 기울인 채 멈춰도 기준은 그대로', () => {
  const det = createTiltDetector();
  const clock = { t: 0 };
  const base = posture(40);
  ready(det, base, clock);
  const drifted = turn(base, 'x', 5);                         // 5° 숙인 채로 편하게 들고 있음
  hold(det, drifted, 900, clock);
  assert.deepEqual(hold(det, turn(drifted, 'x', -12.5), 50, clock), ['up']);   // 새 기준에서 12.5°
  hold(det, drifted, 900, clock);
  assert.deepEqual(hold(det, turn(drifted, 'y', 20), 2000, clock), ['right']); // 기울인 채 2초: 계속 오른쪽
});

test('감도: 둔하게 18° · 보통 12° · 민감 8°', () => {
  for (const [level, deg] of Object.entries(SENSITIVITY)) {
    const det = createTiltDetector({ on: deg });
    const clock = { t: 0 };
    const base = posture(45);
    ready(det, base, clock);
    assert.deepEqual(hold(det, turn(base, 'y', deg - 1.5), 50, clock), [], `${level} 미만`);
    assert.deepEqual(hold(det, turn(base, 'y', deg + 1), 50, clock), ['right'], `${level} 이상`);
  }
});

test('나침반 값(alpha)이 없어도 앞뒤·좌우가 동작한다', () => {
  const det = createTiltDetector();
  let t = 0;
  for (let i = 0; i < 30; i++) det.feed(45, 0, 0, null, (t += 16));
  assert.equal(det.state, 'ready');
  assert.deepEqual(det.feed(45, 16, 0, null, (t += 16)).dirs, ['right']);
});

test('잘못된 값은 무시하고, 화면이 회전하면 기준을 다시 잡는다', () => {
  const det = createTiltDetector();
  const clock = { t: 0 };
  ready(det, posture(30), clock);
  assert.deepEqual(det.feed(null, 5).dirs, []);
  assert.deepEqual(det.feed(NaN, 5).dirs, []);
  hold(det, posture(30), 50, clock, 90);
  assert.equal(det.state, 'calib');
});
