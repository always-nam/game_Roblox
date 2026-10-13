import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toScreen, dominant, createTiltDetector } from '../../src/motion.js';

test('세로 화면: 오른쪽 모서리를 내리면 오른쪽, 윗부분을 들면 아래', () => {
  assert.equal(dominant(toScreen(20, 0, 0)).dir, 'right');
  assert.equal(dominant(toScreen(-20, 0, 0)).dir, 'left');
  assert.equal(dominant(toScreen(0, 20, 0)).dir, 'down');
  assert.equal(dominant(toScreen(0, -20, 0)).dir, 'up');
});

test('가로 화면(90/270/180)에서도 화면 기준 방향으로 바뀐다', () => {
  // 90°: 기기 윗부분이 화면 왼쪽 → 기기 아래쪽(beta +)이 화면 오른쪽
  assert.equal(dominant(toScreen(0, 20, 90)).dir, 'right');
  assert.equal(dominant(toScreen(20, 0, 90)).dir, 'up');
  assert.equal(dominant(toScreen(0, 20, 270)).dir, 'left');
  assert.equal(dominant(toScreen(20, 0, 270)).dir, 'down');
  assert.equal(dominant(toScreen(20, 0, 180)).dir, 'left');
  assert.equal(dominant(toScreen(0, 20, -90)).dir, 'left'); // -90은 270과 같다
});

test('처음 값을 수평 기준으로 삼는다 (비스듬히 든 상태가 0)', () => {
  const t = createTiltDetector();
  assert.equal(t.feed(0, 40).dir, null);       // 40° 들고 시작 → 기준
  assert.equal(t.feed(0, 50).dir, null);       // 10°: 아직 아님
  assert.equal(t.feed(0, 58).dir, 'down');     // 18° → 아래
});

test('한 번 기울이면 기준 근처로 돌아올 때까지 다시 반응하지 않는다', () => {
  const t = createTiltDetector();
  t.feed(0, 0);
  assert.equal(t.feed(25, 0).dir, 'right');
  assert.equal(t.feed(30, 0).dir, null);
  assert.equal(t.feed(12, 0).dir, null);       // 아직 7°보다 큼
  assert.equal(t.feed(-25, 0).dir, null);      // 되돌아오지 않고 반대로 넘어가도 무시
  assert.equal(t.feed(3, 0).dir, null);        // 기준 근처 → 재무장
  assert.equal(t.feed(-20, 0).dir, 'left');
});

test('대각선이면 더 많이 기운 쪽을 고른다', () => {
  const t = createTiltDetector();
  t.feed(0, 0);
  assert.equal(t.feed(17, 25).dir, 'down');
});

test('calibrate 후 새 기준을 잡고, 잘못된 값은 무시한다', () => {
  const t = createTiltDetector();
  t.feed(0, 0);
  t.calibrate();
  assert.equal(t.feed(10, 10).dir, null);
  assert.deepEqual(t.base, { x: 10, y: 10, angle: 0 });
  assert.equal(t.feed(null, 5).dir, null);
  assert.equal(t.feed(NaN, 5).dir, null);
});

test('화면이 회전하면 기준을 다시 잡는다', () => {
  const t = createTiltDetector();
  t.feed(0, 30, 0);
  assert.equal(t.feed(0, 30, 90).dir, null);
  assert.equal(t.base.angle, 90);
});
