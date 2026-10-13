// 휴대폰 기울기(DeviceOrientation) → 판 기울이기 방향 변환. DOM 없이 테스트할 수 있는 순수 로직.
//
// 브라우저가 주는 beta(앞뒤)·gamma(좌우) 각도는 휴대폰을 세울수록(beta≈90°) 값이 튀거나 되감기는
// 문제가 있다(오일러 각의 짐벌 락). 그래서 각도를 먼저 '기기 기준 중력 방향(위쪽 벡터)'으로 바꾼 뒤,
// 세로를 지나도 끊기지 않는 pitch(앞뒤)·roll(좌우)을 다시 계산해서 쓴다.
//
//   pitch : 휴대폰 윗부분이 사용자 쪽으로 들릴수록 + (눕힘 0°, 세움 90°, 더 젖히면 90° 초과)
//   roll  : 오른쪽 모서리가 내려갈수록 +
//   angle : 화면 회전 각도(screen.orientation.angle: 0, 90, 180, 270)

export const TILT_ON = 14;    // 기준에서 이 각도 이상 기울이면 한 번 기울인 것으로 본다
export const TILT_OFF = 6;    // 기울인 방향으로 이 각도 아래까지 돌아와야 다음 기울이기를 받는다
export const DRIFT_ZONE = 7;  // 이 범위 안의 작은 흔들림에는 기준이 천천히 따라온다(자세 변화 보정)
export const DRIFT_RATE = 0.01;

const RAD = Math.PI / 180;

/** beta/gamma(도) → 기기 좌표계에서 본 '위쪽' 단위 벡터 (x: 기기 오른쪽, y: 기기 윗변, z: 화면 밖) */
export function upVector(beta, gamma) {
  const b = beta * RAD;
  const g = gamma * RAD;
  return { x: -Math.sin(g) * Math.cos(b), y: Math.sin(b), z: Math.cos(g) * Math.cos(b) };
}

/** 위쪽 벡터 → 세로를 지나도 연속인 pitch/roll(도) */
export function pitchRoll(beta, gamma) {
  const u = upVector(beta, gamma);
  return {
    pitch: Math.atan2(u.y, u.z) / RAD,
    roll: Math.atan2(-u.x, Math.hypot(u.y, u.z)) / RAD,
  };
}

const wrap180 = (a) => ((((a + 180) % 360) + 360) % 360) - 180;

/** 기기 기준 기울기(roll=좌우, pitch=앞뒤)를 화면 기준 {x, y}(오른쪽·아래가 +)로 바꾼다 */
export function toScreen(roll, pitch, angle = 0) {
  switch (((angle % 360) + 360) % 360) {
    case 90: return { x: pitch, y: -roll };
    case 180: return { x: -roll, y: -pitch };
    case 270: return { x: -pitch, y: roll };
    default: return { x: roll, y: pitch };
  }
}

/** 화면 기준 기울기에서 우세한 방향과 크기를 구한다 */
export function dominant({ x, y }) {
  if (Math.abs(x) >= Math.abs(y)) return { dir: x >= 0 ? 'right' : 'left', mag: Math.abs(x) };
  return { dir: y >= 0 ? 'down' : 'up', mag: Math.abs(y) };
}

const along = (dir, d) => ({ right: d.x, left: -d.x, down: d.y, up: -d.y }[dir]);

/**
 * 기울기 감지기. feed(beta, gamma, angle)에 센서 값을 넣으면 기울이기가 확정될 때 방향을 돌려준다.
 * - 처음 값(또는 calibrate 이후 첫 값)을 '수평' 기준으로 삼는다. 손에 든 자연스러운 각도가 0이다.
 * - 기준 근처의 작은 흔들림에는 기준이 천천히 따라와, 자세가 조금씩 바뀌어도 계속 동작한다.
 * - 한 방향으로 기울인 뒤에는 그 방향으로의 기울기가 TILT_OFF 아래로 돌아와야 다음 입력을 받는다.
 */
export function createTiltDetector({ on = TILT_ON, off = TILT_OFF, driftZone = DRIFT_ZONE, driftRate = DRIFT_RATE } = {}) {
  let base = null;
  let armed = true;
  let lastDir = null;
  return {
    calibrate() { base = null; armed = true; lastDir = null; },
    get base() { return base; },
    get armed() { return armed; },
    /** 반환: { dir: 방향|null, x, y, armed } — x, y는 기준 대비 화면 기준 기울기(도) */
    feed(beta, gamma, angle = 0) {
      if (beta == null || gamma == null || Number.isNaN(beta) || Number.isNaN(gamma)) return { dir: null, x: 0, y: 0, armed };
      const { pitch, roll } = pitchRoll(beta, gamma);
      if (!base || base.angle !== angle) { base = { pitch, roll, angle }; armed = true; lastDir = null; }
      const d = toScreen(roll - base.roll, wrap180(pitch - base.pitch), angle);
      const { dir, mag } = dominant(d);
      if (armed && mag >= on) {
        armed = false;
        lastDir = dir;
        return { dir, ...d, armed };
      }
      if (!armed && along(lastDir, d) <= off) armed = true;
      if (armed && mag < driftZone) {
        base.pitch += wrap180(pitch - base.pitch) * driftRate;
        base.roll += (roll - base.roll) * driftRate;
      }
      return { dir: null, ...d, armed };
    },
  };
}
