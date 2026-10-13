// 구슬 굴러가기 연출 — 순수 계산(DOM 없음). main.js가 Web Animations API로 재생한다.
//
// 실제 공처럼: 기울어진 판 위의 공은 멈춘 상태에서 출발해 점점 빨라진다(등가속 운동, 거리 ∝ 시간²).
// 벽에 부딪히면 살짝 찌그러졌다가 조금 튕겨 나온 뒤 멈춘다. 구슬 표면 무늬는 굴러간 거리만큼
// 진행 방향으로 돌아가고, 하이라이트(빛 반사)는 제자리에 있어 실제로 구르는 것처럼 보인다.

export const ROLL = {
  base: 60,          // ms: 출발 준비
  perSqrtCell: 190,  // ms × √칸수: 등가속이면 걸리는 시간은 거리의 제곱근에 비례
  impact: 0.8,       // 벽에 닿는 시점(전체 시간 대비)
  bounce: 0.12,      // 튕겨 나오는 거리(칸)
  squash: 0.12,      // 부딪힐 때 찌그러지는 정도
};

// 등가속(출발 0 → 점점 빠르게)에 가까운 곡선: easeInQuad
export const EASE_ACCEL = 'cubic-bezier(0.55, 0.085, 0.68, 0.53)';

/** n칸을 굴러가는 데 걸리는 시간(ms). 튕김 포함 여부에 따라 */
export function rollDuration(cells, { bounce = true } = {}) {
  if (cells <= 0) return 0;
  const travel = ROLL.base + ROLL.perSqrtCell * Math.sqrt(cells);
  return Math.round(bounce ? travel / ROLL.impact : travel);
}

const px = (x, y, cell) => `translate(${(x * cell).toFixed(2)}px, ${(y * cell).toFixed(2)}px)`;

/**
 * 한 조각의 이동 키프레임.
 * from/to: 칸 좌표 {x, y}, cell: 칸 크기(px), end: 'stop' | 'hole' | 'pit' | 'plug', kind: 'marble' | 'stone'
 * 반환: { duration, frames, skinFrames } — skinFrames는 구슬 표면 무늬(background-position)용
 */
export function rollKeyframes({ from, to, cell, end = 'stop', kind = 'marble', skin = { x: 0, y: 0 } }) {
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  const cells = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
  const bounce = end === 'stop';
  const duration = rollDuration(cells, { bounce });
  const dist = cells * cell;
  const skinTo = { x: skin.x + dx * dist, y: skin.y + dy * dist };
  const bp = (p) => `${p.x.toFixed(1)}px ${p.y.toFixed(1)}px`;

  if (!bounce) {
    return {
      duration,
      frames: [
        { offset: 0, transform: px(from.x, from.y, cell), easing: EASE_ACCEL },
        { offset: 1, transform: px(to.x, to.y, cell) },
      ],
      skinFrames: kind === 'marble' ? [
        { offset: 0, backgroundPosition: bp(skin), easing: EASE_ACCEL },
        { offset: 1, backgroundPosition: bp(skinTo) },
      ] : null,
      skinEnd: skinTo,
    };
  }

  const b = ROLL.bounce * (kind === 'stone' ? 0.4 : 1);   // 돌은 무거워서 덜 튕긴다
  const s = ROLL.squash * (kind === 'stone' ? 0.3 : 1);
  const back = { x: to.x - dx * b, y: to.y - dy * b };
  // 진행 방향으로 납작해지고 옆으로 퍼진다
  const squash = dx ? `scale(${1 - s}, ${1 + s / 2})` : `scale(${1 + s / 2}, ${1 - s})`;
  const skinBack = { x: skinTo.x - dx * b * cell, y: skinTo.y - dy * b * cell };
  return {
    duration,
    frames: [
      { offset: 0, transform: `${px(from.x, from.y, cell)} scale(1, 1)`, easing: EASE_ACCEL },
      { offset: ROLL.impact, transform: `${px(to.x, to.y, cell)} ${squash}`, easing: 'ease-out' },
      { offset: ROLL.impact + (1 - ROLL.impact) * 0.5, transform: `${px(back.x, back.y, cell)} scale(1, 1)`, easing: 'ease-in-out' },
      { offset: 1, transform: `${px(to.x, to.y, cell)} scale(1, 1)` },
    ],
    skinFrames: kind === 'marble' ? [
      { offset: 0, backgroundPosition: bp(skin), easing: EASE_ACCEL },
      { offset: ROLL.impact, backgroundPosition: bp(skinTo), easing: 'ease-out' },
      { offset: ROLL.impact + (1 - ROLL.impact) * 0.5, backgroundPosition: bp(skinBack), easing: 'ease-in-out' },
      { offset: 1, backgroundPosition: bp(skinTo) },
    ] : null,
    skinEnd: skinTo,
  };
}
