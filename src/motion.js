// 휴대폰 기울기(DeviceOrientation) → 판 기울이기 방향 변환. DOM 없이 테스트할 수 있는 순수 로직.
//
// 설계 (실기기 갤럭시 폴드 진단 값으로 확인한 문제를 반영)
// 1. 기준 자세는 '휴대폰이 잠깐 멈췄을 때' 잡는다. 버튼을 누르는 순간의 흔들림을 기준으로 삼으면
//    모든 방향이 대각선으로 치우친다.
// 2. 기울기는 기준 자세에서 '기기 자신의 축으로 얼마나 돌렸는지'로 잰다. 중력 투영으로 재면
//    휴대폰을 세워 들었을 때 좌우 기울기가 절반 이하로 줄어든다(63° 들고 15° 기울이면 6.7°).
//      앞뒤 = 기기 가로축(x) 회전, 좌우 = 기기 세로축(y) 회전 + 세워 들었을 때의 핸들 돌리기(z)
// 3. 기준 근처에서 멈춰 있으면 그 자세로 기준을 다시 맞춘다(자세가 바뀌어도 계속 동작).
//    기울인 채 오래 멈추면 그 자세를 새 기준으로 삼고, 돌아오는 동작은 반대 입력으로 치지 않는다.

export const SENSITIVITY = { low: 18, normal: 12, high: 8 };   // 입력으로 인정하는 기울기(도)
export const REST_SPEED = 25;     // 이보다 느리게 움직이면(도/초) 멈춘 것으로 본다
export const CALIB_MS = 300;      // 처음 기준: 이만큼 멈추면 잡는다
export const RECENTER_MS = 700;   // 기준 근처에서 이만큼 멈추면 기준을 다시 맞춘다
export const HOLD_MS = 1200;      // 기울인 채 이만큼 멈추면 그 자세를 새 기준으로

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

const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
const along = (dir, d) => ({ right: d.x, left: -d.x, down: d.y, up: -d.y }[dir]);

/**
 * 기울기 감지기. feed(beta, gamma, angle, alpha, t)에 센서 값을 넣으면 기울이기가 확정될 때 방향을 돌려준다.
 * 반환: { dir, x, y, state } — state: 'calib'(기준 잡는 중) | 'armed'(입력 대기) | 'fired'(되돌아오기 대기)
 */
export function createTiltDetector({ on = SENSITIVITY.normal, off = on * 0.45 } = {}) {
  let state = 'calib';
  let base = null;
  let baseAngle = 0;
  let prev = null;
  let restSince = null;
  let lastDir = null;
  let guard = null;
  let guardMoved = false;   // 막아 둔 반대 방향: 한 번 움직였다가 다시 멈춰야 풀린다
  return {
    get state() { return state; },
    get base() { return base; },
    get threshold() { return on; },
    calibrate() { state = 'calib'; base = null; restSince = null; guard = null; lastDir = null; prev = null; },
    feed(beta, gamma, angle = 0, alpha = 0, t = Date.now()) {
      const idle = { dir: null, x: 0, y: 0, state };
      if (beta == null || gamma == null || Number.isNaN(beta) || Number.isNaN(gamma)) return idle;
      const R = eulerToMatrix(alpha == null || Number.isNaN(alpha) ? 0 : alpha, beta, gamma);

      // 멈춤 판정: 직전 값과의 회전 속도
      if (prev) {
        const speed = rotationAngle(prev.R, R) / Math.max(1, t - prev.t) * 1000;
        if (speed < REST_SPEED) restSince ??= prev.t;
        else { restSince = null; guardMoved = true; }
      } else {
        restSince = t;
      }
      prev = { R, t };
      let restFor = restSince == null ? 0 : t - restSince;

      if (base && angle !== baseAngle) { state = 'calib'; base = null; restSince = t; restFor = 0; }
      if (state === 'calib') {
        if (restFor >= CALIB_MS) { base = R; baseAngle = angle; state = 'armed'; guard = null; }
        return { dir: null, x: 0, y: 0, state };
      }

      const d = tiltIntent(base, R, angle);
      const { dir, mag } = dominant(d);
      if (state === 'armed') {
        if (mag >= on && dir !== guard) {
          state = 'fired';
          lastDir = dir;
          guard = null;
          return { dir, ...d, state };
        }
        if (restFor >= RECENTER_MS) {                // 멈춰 있으면 지금 자세로 기준 재설정
          base = R;
          restSince = t;
          if (guardMoved) guard = null;
        }
      } else if (state === 'fired') {
        if (along(lastDir, d) <= off) {
          state = 'armed';
        } else if (restFor >= HOLD_MS) {
          base = R;                       // 기울인 채 멈춤 → 그 자세가 새 기준
          restSince = t;
          state = 'armed';
          guard = OPPOSITE[lastDir];      // 원래 자세로 돌아오는 동작은 반대 입력으로 치지 않는다
          guardMoved = false;
        }
      }
      return { dir: null, ...d, state };
    },
  };
}
