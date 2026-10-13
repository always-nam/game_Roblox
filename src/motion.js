// 휴대폰 기울기(DeviceOrientation) → 판 기울이기 방향 변환. DOM 없이 테스트할 수 있는 순수 로직.
//
// 설계 (실기기 갤럭시 폴드 진단 값으로 확인한 문제를 반영)
// 1. 기준 자세는 '휴대폰이 잠깐 멈췄을 때' 잡는다. 버튼을 누르는 순간의 흔들림을 기준으로 삼으면
//    모든 방향이 대각선으로 치우친다.
// 2. 기울기는 기준 자세에서 '기기 자신의 축으로 얼마나 돌렸는지'로 잰다. 중력 투영으로 재면
//    휴대폰을 세워 들었을 때 좌우 기울기가 절반 이하로 줄어든다(63° 들고 15° 기울이면 6.7°).
//      앞뒤 = 기기 가로축(x) 회전, 좌우 = 기기 세로축(y) 회전 + 세워 들었을 때의 핸들 돌리기(z)
// 3. '흐름' 방식: 판은 지금 기울어진 방향으로 계속 흐른다. 정중앙으로 돌아올 필요가 없다.
//    같은 방향으로 두 번 기울여도 이 게임에서는 아무것도 바뀌지 않으므로(이미 끝까지 굴러감),
//    마지막에 적용한 방향과 '다른' 기울어진 방향만 적용하면 된다. 대각선이면 두 방향을 번갈아
//    적용해 더 움직이지 않을 때까지 굴러간다(실제 판을 대각선으로 기울인 것과 같은 결과).
// 4. 기준 근처에서 멈춰 있으면 그 자세로 기준을 다시 맞춘다(자세가 바뀌어도 계속 동작).

export const SENSITIVITY = { low: 18, normal: 12, high: 8 };   // 입력으로 인정하는 기울기(도)
export const REST_SPEED = 25;     // 이보다 느리게 움직이면(도/초) 멈춘 것으로 본다
export const CALIB_MS = 300;      // 처음 기준: 이만큼 멈추면 잡는다
export const RECENTER_MS = 700;   // 기준 근처에서 이만큼 멈추면 기준을 다시 맞춘다
export const AXIS_SHARE = 0.5;    // 대각선: 전체 기울기가 기준을 넘으면, 그 절반 이상인 방향 성분도 인정

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/** W3C DeviceOrientation(Z-X'-Y'' 순서) 각도 → 회전 행렬(기기 좌표 → 지구 좌표) */
export function eulerToMatrix(alpha, beta, gamma) {
  const a = (alpha || 0) * RAD, b = beta * RAD, g = gamma * RAD;
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cg = Math.cos(g), sg = Math.sin(g);
  return [
    [ca * cg - sa * sb * sg, -sa * cb, ca * sg + sa * sb * cg],
    [sa * cg + ca * sb * sg, ca * cb, sa * sg - ca * sb * cg],
    [-cb * sg, sb, cb * cg],
  ];
}

/** 회전 행렬 → W3C 각도 [alpha, beta, gamma] (테스트용) */
export function matrixToEuler(R) {
  const beta = Math.asin(Math.max(-1, Math.min(1, R[2][1]))) * DEG;
  const gamma = Math.atan2(-R[2][0], R[2][2]) * DEG;
  const alpha = (Math.atan2(-R[0][1], R[1][1]) * DEG + 360) % 360;
  return [alpha, beta, gamma];
}

export function mul(A, B) {
  return A.map((row) => [0, 1, 2].map((j) => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]));
}
export function transpose(A) {
  return [0, 1, 2].map((i) => [A[0][i], A[1][i], A[2][i]]);
}

/** 기기 축 회전 행렬 (테스트·도구용) */
export function axisRotation(axis, deg) {
  const c = Math.cos(deg * RAD), s = Math.sin(deg * RAD);
  if (axis === 'x') return [[1, 0, 0], [0, c, -s], [0, s, c]];
  if (axis === 'y') return [[c, 0, s], [0, 1, 0], [-s, 0, c]];
  return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
}

/** 상대 회전 행렬 → 회전 벡터(도). 축 방향 × 회전각 */
function rotationVector(R) {
  const tr = R[0][0] + R[1][1] + R[2][2];
  const theta = Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2)));
  const v = [(R[2][1] - R[1][2]) / 2, (R[0][2] - R[2][0]) / 2, (R[1][0] - R[0][1]) / 2];
  const k = theta < 1e-6 ? 1 : theta / Math.sin(theta);
  return v.map((c) => c * k * DEG);
}

function rotationAngle(A, B) {
  const R = mul(transpose(A), B);
  const tr = R[0][0] + R[1][1] + R[2][2];
  return Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2))) * DEG;
}

/** 기기 기준 기울기(X=오른쪽, Y=아래쪽으로 굴러감)를 화면 기준 {x, y}로 바꾼다 */
export function toScreen(X, Y, angle = 0) {
  switch (((angle % 360) + 360) % 360) {
    case 90: return { x: Y, y: -X };
    case 180: return { x: -X, y: -Y };
    case 270: return { x: -Y, y: X };
    default: return { x: X, y: Y };
  }
}

/** 기준 자세 base(행렬)에서 지금 자세 R까지, 사용자가 의도한 기울기(화면 기준, 도) */
export function tiltIntent(base, R, angle = 0) {
  const w = rotationVector(mul(transpose(base), R));   // 기준 자세의 기기 좌표로 본 회전
  const up = base[2];                                   // 기준 자세에서 '위쪽'의 기기 좌표 (세운 정도)
  // 쟁반처럼 기울이기(x·y축) + 세워 들었을 때 핸들처럼 돌리기(z축, 세운 만큼만 반영)
  const X = w[1] - w[2] * up[1];
  const Y = w[0] - w[2] * up[0];
  return toScreen(X, Y, angle);
}

/** 화면 기준 기울기에서 우세한 방향과 크기 */
export function dominant({ x, y }) {
  if (Math.abs(x) >= Math.abs(y)) return { dir: x >= 0 ? 'right' : 'left', mag: Math.abs(x) };
  return { dir: y >= 0 ? 'down' : 'up', mag: Math.abs(y) };
}

/**
 * 지금 기울기에서 '기울어진' 방향들 (센 쪽부터). 전체 크기가 on 이상이어야 하고,
 * 각 축 성분이 on × AXIS_SHARE 이상이면 그 방향도 포함한다(대각선 = 두 방향).
 */
export function activeDirs({ x, y }, on) {
  if (Math.hypot(x, y) < on) return [];
  const comps = [[x >= 0 ? 'right' : 'left', Math.abs(x)], [y >= 0 ? 'down' : 'up', Math.abs(y)]]
    .filter(([, v]) => v >= on * AXIS_SHARE)
    .sort((a, b) => b[1] - a[1]);
  return comps.map(([d]) => d);
}

/** 적용할 방향 후보: 기울어진 방향 중 마지막에 적용한 방향은 빼고(이미 끝까지 굴러간 상태), 센 쪽부터 */
export function nextDirs(d, last, on) {
  return activeDirs(d, on).filter((dir) => dir !== last);
}

/**
 * 기울기 감지기. feed(beta, gamma, angle, alpha, t) → { x, y, dirs, state }
 *  - x, y : 기준 대비 화면 기준 기울기(도)
 *  - dirs : 지금 기울어진 방향들(센 쪽부터). 무엇을 적용할지는 게임 쪽에서 nextDirs로 고른다.
 *  - state: 'calib'(기준 잡는 중) | 'ready'
 */
export function createTiltDetector({ on = SENSITIVITY.normal } = {}) {
  let state = 'calib';
  let base = null;
  let baseAngle = 0;
  let prev = null;
  let restSince = null;
  return {
    get state() { return state; },
    get base() { return base; },
    get threshold() { return on; },
    calibrate() { state = 'calib'; base = null; restSince = null; prev = null; },
    feed(beta, gamma, angle = 0, alpha = 0, t = Date.now()) {
      const idle = { x: 0, y: 0, dirs: [], state };
      if (beta == null || gamma == null || Number.isNaN(beta) || Number.isNaN(gamma)) return idle;
      const R = eulerToMatrix(alpha == null || Number.isNaN(alpha) ? 0 : alpha, beta, gamma);

      // 멈춤 판정: 직전 값과의 회전 속도
      if (prev) {
        const speed = rotationAngle(prev.R, R) / Math.max(1, t - prev.t) * 1000;
        if (speed < REST_SPEED) restSince ??= prev.t;
        else restSince = null;
      } else {
        restSince = t;
      }
      prev = { R, t };
      let restFor = restSince == null ? 0 : t - restSince;

      if (base && angle !== baseAngle) { state = 'calib'; base = null; restSince = t; restFor = 0; }
      if (state === 'calib') {
        if (restFor >= CALIB_MS) { base = R; baseAngle = angle; state = 'ready'; }
        return { x: 0, y: 0, dirs: [], state };
      }

      const d = tiltIntent(base, R, angle);
      // 기준 근처(입력 각도의 절반 이내)에서 멈춰 있으면 지금 자세로 기준을 다시 맞춘다
      if (restFor >= RECENTER_MS && Math.hypot(d.x, d.y) < on * 0.5) {
        base = R;
        restSince = t;
      }
      return { ...d, dirs: activeDirs(d, on), state };
    },
  };
}
