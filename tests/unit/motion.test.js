import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pitchRoll, toScreen, dominant, createTiltDetector } from '../../src/motion.js';

const close = (a, b, eps = 0.5) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);
// 오일러 각(beta, gamma)의 다른 표현: 세로를 지난 자세를 beta∈[-90,90], gamma를 180° 뒤집어 표현하는 브라우저도 있다
const altEuler = (beta, gamma) => [180 - beta, gamma > 0 ? gamma - 180 : gamma + 180];

test('pitch/roll은 작은 각도에서 beta/gamma와 같다', () => {
  const { pitch, roll } = pitchRoll(20, 10);
  close(pitch, 20.3, 1);
  close(roll, 9.4, 0.3);   // 실제 좌우 기울기는 앞뒤로 숙인 만큼 조금 줄어든다
});

test('세로(90°)를 지나도 pitch가 끊기지 않고 계속 커진다', () => {
  const values = [70, 80, 89, 90, 91, 100, 110].map((b) => pitchRoll(b, 0).pitch);
  for (let i = 1; i < values.length; i++) assert.ok(values[i] > values[i - 1], values.join(','));
  close(pitchRoll(110, 0).pitch, 110);
});

test('같은 자세를 다른 오일러 표현으로 받아도 pitch/roll이 같다', () => {
  for (const [b, g] of [[100, 5], [120, -10], [95, 30]]) {
    const a = pitchRoll(b, g);
    const c = pitchRoll(...altEuler(b, g));
    close(a.pitch, c.pitch, 0.01);
    close(a.roll, c.roll, 0.01);
  }
});

test('세로로 세운 상태에서 좌우로 돌려도 roll이 나온다 (짐벌 락 없음)', () => {
  // 세운 상태(beta 90)에서 gamma가 튀는 값으로 와도 roll은 작게 유지된다
  close(pitchRoll(89.9, 60).roll, 0, 0.2);
});

test('화면 회전(0/90/180/270)에 따라 화면 기준 방향으로 바뀐다', () => {
  assert.equal(dominant(toScreen(20, 0, 0)).dir, 'right');
  assert.equal(dominant(toScreen(0, 20, 0)).dir, 'down');
  assert.equal(dominant(toScreen(0, 20, 90)).dir, 'right');
  assert.equal(dominant(toScreen(20, 0, 90)).dir, 'up');
  assert.equal(dominant(toScreen(0, 20, 270)).dir, 'left');
  assert.equal(dominant(toScreen(20, 0, 270)).dir, 'down');
  assert.equal(dominant(toScreen(20, 0, 180)).dir, 'left');
  assert.equal(dominant(toScreen(0, 20, -90)).dir, 'left');
});

test('네 방향 모두: 처음 각도를 기준으로 기울이면 그 방향이 나온다', () => {
  for (const [db, dg, want] of [[18, 0, 'down'], [-18, 0, 'up'], [0, 18, 'right'], [0, -18, 'left']]) {
    const t = createTiltDetector();
    t.feed(35, 0);
    assert.equal(t.feed(35 + db, dg).dir, want, want);
  }
});

test('크게 세워 든 상태(80°)에서도 아래로 기울이기가 된다 (폴드 펼친 화면 사례)', () => {
  const t = createTiltDetector();
  t.feed(80, 2);
  assert.equal(t.feed(88, 2).dir, null);
  assert.equal(t.feed(96, 2).dir, 'down');     // 세로를 지나 16°
});

test('세로를 지난 값을 다른 표현(beta 감소 + gamma 뒤집힘)으로 보내는 브라우저에서도 아래가 된다', () => {
  const t = createTiltDetector();
  t.feed(80, 2);
  assert.equal(t.feed(...altEuler(96, 2)).dir, 'down');
});

test('한 번 기울이면 그 방향으로 되돌아올 때까지 다시 반응하지 않는다', () => {
  const t = createTiltDetector();
  t.feed(0, 0);
  assert.equal(t.feed(0, 25).dir, 'right');
  assert.equal(t.feed(0, 30).dir, null);
  assert.equal(t.feed(0, 10).dir, null);       // 아직 6°보다 큼
  assert.equal(t.feed(0, 3).dir, null);        // 돌아옴 → 재무장
  assert.equal(t.feed(0, -20).dir, 'left');
});

test('되돌아온 뒤 앞뒤 자세가 틀어져 있어도 좌우 입력은 다시 받는다', () => {
  const t = createTiltDetector();
  t.feed(30, 0);
  assert.equal(t.feed(30, 20).dir, 'right');
  assert.equal(t.feed(40, 2).dir, null);       // 오른쪽은 돌아왔지만 앞뒤가 10° 틀어짐 → 그래도 재무장
  assert.equal(t.feed(40, -20).dir, 'left');   // 40° 숙인 상태의 gamma 20° = 실제 좌우 약 15°
});

test('기준 근처의 느린 자세 변화에는 기준이 따라온다', () => {
  const t = createTiltDetector();
  t.feed(30, 0);
  for (let i = 0; i < 600; i++) t.feed(35, 0);  // 5° 숙인 채로 10초(60Hz)
  assert.ok(Math.abs(t.base.pitch - 35) < 1, `base ${t.base.pitch}`);
  assert.equal(t.feed(35 + 15, 0).dir, 'down');
});

test('대각선이면 더 많이 기운 쪽을 고른다', () => {
  const t = createTiltDetector();
  t.feed(0, 0);
  assert.equal(t.feed(25, 15).dir, 'down');
});

test('calibrate 후 새 기준을 잡고, 잘못된 값은 무시한다', () => {
  const t = createTiltDetector();
  t.feed(0, 0);
  t.calibrate();
  assert.equal(t.feed(10, 10).dir, null);
  close(t.base.roll, 10, 0.5);
  assert.equal(t.feed(null, 5).dir, null);
  assert.equal(t.feed(NaN, 5).dir, null);
});

test('화면이 회전하면 기준을 다시 잡는다', () => {
  const t = createTiltDetector();
  t.feed(30, 0, 0);
  assert.equal(t.feed(30, 0, 90).dir, null);
  assert.equal(t.base.angle, 90);
});
