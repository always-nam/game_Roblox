// 휴대폰 기울기(DeviceOrientation) → 판 기울이기 방향 변환. DOM 없이 테스트할 수 있는 순수 로직.
//
// 설계 (실기기 갤럭시 폴드 사용 피드백을 반영)
// 1. 원점: 좌우는 '실제 수평'(0°)이 원점이다. 오른쪽으로 기운 채 시작하면 실제 판처럼 바로 오른쪽으로
//    흐른다. 앞뒤는 사람마다 편하게 드는 각도가 달라서 한 번 정한 각도를 원점으로 저장해 쓴다
//    (단계를 시작할 때마다 다시 잡지 않는다 — 기운 채 시작하면 그쪽으로 안 굴러가던 문제).
// 2. 좌우 기울기는 '쟁반처럼 기울인 각도'(화면 가로축 기준)로 잰다. 휴대폰을 세워 들어도 15° 기울이면
//    15°로 잡힌다. 거의 세운 상태에서는 핸들처럼 돌리는 동작도 좌우로 잡힌다.
// 3. 앞뒤 기울기는 세로를 지나도 끊기지 않는 각도(atan2)로 잰다.
// 4. '흐름' 방식: 판은 지금 기울어진 방향으로 계속 흐른다. 같은 방향은 이미 끝까지 굴러간 상태라
//    다시 적용하지 않고, 다른 방향으로 기울이면 바로 그 방향으로 흐른다. 대각선은 두 방향을 번갈아.

export const SENSITIVITY = { low: 18, normal: 12, high: 8 };   // 입력으로 인정하는 기울기(도)
export const REST_SPEED = 25;     // 이보다 느리게 움직이면(도/초) 멈춘 것으로 본다
export const CALIB_MS = 300;      // 원점(앞뒤)을 잡을 때 이만큼 멈춰 있어야 한다
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

/** 기기 축 회전 행렬 (테스트·도구용) */
export function axisRotation(axis, deg) {
  const c = Math.cos(deg * RAD), s = Math.sin(deg * RAD);
  if (axis === 'x') return [[1, 0, 0], [0, c, -s], [0, s, c]];
  if (axis === 'y') return [[c, 0, s], [0, 1, 0], [-s, 0, c]];
  return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
}

const wrap180 = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** 화면 회전 각도별: 화면 오른쪽(r)과 화면 위쪽(t) 방향을 기기 좌표로 */
function screenAxes(angle) {
  switch (((angle % 360) + 360) % 360) {
    case 90: return { r: [0, -1, 0], t: [1, 0, 0] };
    case 180: return { r: [-1, 0, 0], t: [0, -1, 0] };
    case 270: return { r: [0, 1, 0], t: [-1, 0, 0] };
    default: return { r: [1, 0, 0], t: [0, 1, 0] };
  }
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

/**
 * 지금 자세의 절대 기울기(도, 화면 기준)
 *  side : 좌우. 실제 수평이 0, 오른쪽 모서리가 내려가면 +
 *  pitch: 앞뒤. 바닥에 눕히면 0, 화면 위쪽이 들릴수록 +(세우면 90, 더 젖히면 90 초과)
 */
export function absoluteTilt(beta, gamma, angle = 0) {
  const R = eulerToMatrix(0, beta, gamma);
  const up = R[2];                                   // 지구 '위쪽'을 기기 좌표로 본 것
  const { r, t } = screenAxes(angle);
  const ur = dot(up, r), ut = dot(up, t), un = up[2];
  const pitch = Math.atan2(ut, un) * DEG;
  // 세운 정도(0~90°). 70°까지는 쟁반 기울이기 각도를 그대로 쓰고, 그 이상은 세울수록
  // 핸들 돌리기 각도로 넘어간다(완전히 세우면 쟁반 기울이기는 물리적으로 '돌아서기'라 감지할 수 없음)
  const upright = 90 - Math.abs(90 - Math.abs(pitch));
  const k = Math.max(0, Math.min(1, (upright - 70) / 18));
  return {
    side: Math.atan2(-ur, Math.hypot(un, k * ut)) * DEG,
    pitch,
  };
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
  return [[x >= 0 ? 'right' : 'left', Math.abs(x)], [y >= 0 ? 'down' : 'up', Math.abs(y)]]
    .filter(([, v]) => v >= on * AXIS_SHARE)
    .sort((a, b) => b[1] - a[1])
    .map(([d]) => d);
}

/** 적용할 방향 후보: 기울어진 방향 중 마지막에 적용한 방향은 빼고(이미 끝까지 굴러간 상태), 센 쪽부터 */
export function nextDirs(d, last, on) {
  return activeDirs(d, on).filter((dir) => dir !== last);
}

/**
 * 기울기 감지기.
 *   origin: { pitch, angle } — 저장해 둔 앞뒤 원점. 없으면 처음 멈췄을 때 잡는다.
 *   feed(beta, gamma, angle, t) → { x, y, dirs, state, origin }
 *     x, y : 원점 대비 화면 기준 기울기(도). 좌우 원점은 항상 실제 수평.
 *     dirs : 지금 기울어진 방향들(센 쪽부터)
 *     state: 'calib'(앞뒤 원점 잡는 중) | 'ready'
 *     origin: 새로 잡은 원점(저장용, 이번에 잡았을 때만)
 */
export function createTiltDetector({ on = SENSITIVITY.normal, origin = null } = {}) {
  let org = origin && Number.isFinite(origin.pitch) ? { pitch: origin.pitch, angle: origin.angle || 0 } : null;
  let state = org ? 'ready' : 'calib';
  let prev = null;
  let restSince = null;
  return {
    get state() { return state; },
    get origin() { return org; },
    get threshold() { return on; },
    /** 앞뒤 원점을 다시 잡는다(다음에 멈췄을 때의 자세로) */
    calibrate() { state = 'calib'; org = null; restSince = null; prev = null; },
    feed(beta, gamma, angle = 0, t = Date.now()) {
      if (beta == null || gamma == null || Number.isNaN(beta) || Number.isNaN(gamma)) return { x: 0, y: 0, dirs: [], state };
      const a = absoluteTilt(beta, gamma, angle);

      // 멈춤 판정(원점 잡을 때만 필요): 직전 값과의 각속도
      if (prev) {
        const speed = Math.hypot(a.side - prev.side, wrap180(a.pitch - prev.pitch)) / Math.max(1, t - prev.t) * 1000;
        if (speed < REST_SPEED) restSince ??= prev.t;
        else restSince = null;
      } else {
        restSince = t;
      }
      prev = { ...a, t };
      const restFor = restSince == null ? 0 : t - restSince;

      // 화면을 돌리면 앞뒤 축이 바뀌므로 원점을 다시 잡는다
      if (org && org.angle !== angle) { org = null; state = 'calib'; restSince = t; return { x: a.side, y: 0, dirs: [], state }; }
      let fresh = null;
      if (state === 'calib') {
        if (restFor < CALIB_MS) return { x: a.side, y: 0, dirs: [], state };
        org = { pitch: a.pitch, angle };
        fresh = org;
        state = 'ready';
      }
      const d = { x: a.side, y: wrap180(a.pitch - org.pitch) };
      return { ...d, dirs: activeDirs(d, on), state, origin: fresh };
    },
  };
}

// ---------- 흐름 속도 조절 ----------
// 기울인 방향이 바뀌어도 바로 움직이지 않고, 그 방향으로 잠깐(dwell) 기울어 있어야 움직인다.
// 앞 움직임이 끝난 뒤에도 잠깐(gap) 쉬었다가 다음 움직임을 시작해, 연속 흐름이 천천히 이어진다.
export const FLOW = { dwell: 140, gap: 260 };

export function createFlowGate({ dwell = FLOW.dwell, gap = FLOW.gap } = {}) {
  let pending = null;
  return {
    reset() { pending = null; },
    /** cands: 지금 적용 가능한 방향들(우선순위 순), t: 지금 시각, lastEnd: 앞 움직임이 끝난 시각 */
    decide(cands, t, lastEnd = -Infinity) {
      const c = cands[0];
      if (!c) { pending = null; return null; }
      if (!pending || pending.dir !== c) pending = { dir: c, since: t };
      if (t - pending.since >= dwell && t - lastEnd >= gap) { pending = null; return c; }
      return null;
    },
  };
}
