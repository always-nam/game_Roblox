// 휴대폰 기울기(DeviceOrientation) → 판 기울이기 방향 변환. DOM 없이 테스트할 수 있는 순수 로직.
//
// beta  : 앞뒤 기울기(도). 휴대폰 윗부분이 사용자 쪽으로 들리면 +  → 구슬은 화면 아래로
// gamma : 좌우 기울기(도). 오른쪽 모서리가 내려가면 +             → 구슬은 화면 오른쪽으로
// angle : 화면 회전 각도(screen.orientation.angle: 0, 90, 180, 270)

export const TILT_ON = 16;   // 이 각도 이상 기울이면 한 번 기울인 것으로 본다
export const TILT_OFF = 7;   // 이 각도 아래로 돌아와야 다음 기울이기를 받는다

/** 기기 기준 기울기를 화면 기준 {x, y}(오른쪽·아래가 +)로 바꾼다 */
export function toScreen(gamma, beta, angle = 0) {
  switch (((angle % 360) + 360) % 360) {
    case 90: return { x: beta, y: -gamma };
    case 180: return { x: -gamma, y: -beta };
    case 270: return { x: -beta, y: gamma };
    default: return { x: gamma, y: beta };
  }
}

/** 화면 기준 기울기에서 우세한 방향과 크기를 구한다 */
export function dominant({ x, y }) {
  if (Math.abs(x) >= Math.abs(y)) return { dir: x >= 0 ? 'right' : 'left', mag: Math.abs(x) };
  return { dir: y >= 0 ? 'down' : 'up', mag: Math.abs(y) };
}

/**
 * 기울기 감지기. feed()에 센서 값을 넣으면 기울이기가 확정될 때 방향을 돌려준다.
 * 처음 값(또는 calibrate 이후 첫 값)을 '수평' 기준으로 삼아, 손에 든 자연스러운 각도를 0으로 본다.
 * 한 번 기울인 뒤에는 기준 근처로 돌아와야 다음 기울이기를 받는다(연속 입력 방지).
 */
export function createTiltDetector({ on = TILT_ON, off = TILT_OFF } = {}) {
  let base = null;
  let armed = true;
  return {
    calibrate() { base = null; armed = true; },
    get base() { return base; },
    /** 반환: { dir: 방향|null, x, y } — x, y는 기준 대비 화면 기준 기울기(도) */
    feed(gamma, beta, angle = 0) {
      if (gamma == null || beta == null || Number.isNaN(gamma) || Number.isNaN(beta)) return { dir: null, x: 0, y: 0 };
      const s = toScreen(gamma, beta, angle);
      if (!base || base.angle !== angle) { base = { x: s.x, y: s.y, angle }; armed = true; }
      const d = { x: s.x - base.x, y: s.y - base.y };
      const { dir, mag } = dominant(d);
      if (armed && mag >= on) { armed = false; return { dir, ...d }; }
      if (!armed && Math.max(Math.abs(d.x), Math.abs(d.y)) <= off) armed = true;
      return { dir: null, ...d };
    },
  };
}
