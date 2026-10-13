// 효과음 — 음원 파일 없이 Web Audio API로 직접 만든다(나무판 위 유리구슬 느낌).
//   굴러감: 걸러낸 잡음(럼블)이 점점 커지고 높아짐 + 칸 이음새를 지날 때 '톡'
//   벽 충돌: 나무를 두드리는 소리, 구멍: '퐁' 하고 떨어지는 소리, 함정: 낮게 떨어지는 소리
//   성공: 차임 화음, 실패: 내려가는 소리
// 브라우저는 사용자가 화면을 누르기 전에는 소리를 낼 수 없으므로 첫 탭·키 입력 때 준비한다.

let ctx = null;
let master = null;
let noise = null;
let enabled = true;
export const soundStats = { roll: 0, hit: 0, hole: 0, pit: 0, plug: 0, win: 0, lose: 0, click: 0, bump: 0 };

export function setSoundEnabled(on) {
  enabled = !!on;
  if (master && ctx) master.gain.setTargetAtTime(enabled ? 0.8 : 0, ctx.currentTime, 0.02);
}
export function soundEnabled() { return enabled; }

/** 첫 사용자 입력에서 호출: 오디오 준비(이미 준비됐으면 일시정지 해제) */
export function unlockAudio() {
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return false;
  try {
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = enabled ? 0.8 : 0;
      const comp = ctx.createDynamicsCompressor();   // 여러 구슬 소리가 겹쳐도 찢어지지 않게
      master.connect(comp).connect(ctx.destination);
      const len = Math.floor(ctx.sampleRate * 1.5);
      noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noise.getChannelData(0);
      let b = 0;
      for (let i = 0; i < len; i++) { b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); d[i] = b * 6; }   // 갈색 잡음(낮은 웅웅거림)
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  } catch { return false; }
}

const ready = () => enabled && ctx && master;
const now = () => ctx.currentTime;

function tone({ at = 0, freq, to = freq, dur = 0.2, type = 'sine', gain = 0.3, attack = 0.004 }) {
  const t = now() + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noiseBurst({ at = 0, dur = 0.05, freq = 2000, q = 1, gain = 0.2, type = 'bandpass' }) {
  const t = now() + at;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

/**
 * 굴러가는 소리. dur: 이동 시간(초), cells: 칸 수, kind: 'marble'|'stone', vol: 여러 개일 때 줄이는 배율
 * 등가속이라 k번째 칸 이음새를 지나는 시각은 dur × √(k/cells)
 */
export function playRoll({ dur, cells, kind = 'marble', vol = 1 }) {
  if (!ready() || dur <= 0) return;
  soundStats.roll++;
  const t = now();
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  const stone = kind === 'stone';
  f.frequency.setValueAtTime(stone ? 180 : 260, t);
  f.frequency.exponentialRampToValueAtTime(stone ? 420 : 900, t + dur);   // 빨라질수록 높아짐
  const g = ctx.createGain();
  const peak = (stone ? 0.5 : 0.35) * vol;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.9);              // 빨라질수록 커짐
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.04);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random());
  src.stop(t + dur + 0.08);
  if (!stone) {
    for (let k = 1; k < cells; k++) {
      const at = dur * Math.sqrt(k / cells);
      noiseBurst({ at, dur: 0.018, freq: 3200, q: 4, gain: 0.05 * vol * (0.5 + k / cells) });
    }
  }
}

/** 벽(나무)에 부딪힘. speed: 0~1 */
export function playHit({ at = 0, speed = 1, kind = 'marble', vol = 1 }) {
  if (!ready()) return;
  soundStats.hit++;
  const s = 0.4 + 0.6 * speed;
  if (kind === 'stone') {
    tone({ at, freq: 110, to: 60, dur: 0.18, gain: 0.45 * s * vol });
    noiseBurst({ at, dur: 0.07, freq: 500, q: 1, gain: 0.35 * s * vol });
  } else {
    tone({ at, freq: 520, to: 300, dur: 0.09, type: 'triangle', gain: 0.22 * s * vol });   // 나무 '똑'
    tone({ at, freq: 1900, to: 1500, dur: 0.05, gain: 0.08 * s * vol });                  // 유리 '찰'
    noiseBurst({ at, dur: 0.03, freq: 2500, q: 2, gain: 0.18 * s * vol });
  }
  vibrate(kind === 'stone' ? 25 : 12);
}

/** 구멍에 쏙 */
export function playHole({ at = 0, vol = 1 }) {
  if (!ready()) return;
  soundStats.hole++;
  tone({ at, freq: 880, to: 330, dur: 0.22, gain: 0.25 * vol });
  tone({ at: at + 0.12, freq: 660, to: 990, dur: 0.18, gain: 0.12 * vol });      // 안에서 '달그락'
  noiseBurst({ at: at + 0.16, dur: 0.05, freq: 1800, q: 3, gain: 0.12 * vol });
  vibrate(30);
}

/** 함정에 빠짐 */
export function playPit({ at = 0 }) {
  if (!ready()) return;
  soundStats.pit++;
  tone({ at, freq: 300, to: 45, dur: 0.6, type: 'triangle', gain: 0.35 });
  vibrate([60, 40, 60]);
}

/** 돌이 함정을 메움 */
export function playPlug({ at = 0 }) {
  if (!ready()) return;
  soundStats.plug++;
  tone({ at, freq: 140, to: 50, dur: 0.3, gain: 0.5 });
  noiseBurst({ at, dur: 0.12, freq: 300, q: 0.7, gain: 0.4, type: 'lowpass' });
  vibrate(40);
}

/** 움직일 게 없을 때 판이 '덜컥' */
export function playBump() {
  if (!ready()) return;
  soundStats.bump++;
  tone({ freq: 120, to: 90, dur: 0.08, type: 'triangle', gain: 0.18 });
}

export function playClick() {
  if (!ready()) return;
  soundStats.click++;
  tone({ freq: 1400, to: 1100, dur: 0.04, type: 'triangle', gain: 0.06 });
}

/** 성공: 별 개수만큼 올라가는 차임 */
export function playWin(stars = 3) {
  if (!ready()) return;
  soundStats.win++;
  const notes = [523.25, 659.25, 783.99, 1046.5];   // 도 미 솔 도
  notes.slice(0, 1 + stars).forEach((f, i) => {
    tone({ at: 0.15 + i * 0.13, freq: f, dur: 0.6, gain: 0.18 });
    tone({ at: 0.15 + i * 0.13, freq: f * 2, dur: 0.4, gain: 0.05 });
  });
}

export function playLose() {
  if (!ready()) return;
  soundStats.lose++;
  [392, 330, 262].forEach((f, i) => tone({ at: 0.1 + i * 0.16, freq: f, to: f * 0.97, dur: 0.3, type: 'triangle', gain: 0.18 }));
}

function vibrate(pattern) {
  try { if (enabled && navigator.vibrate) navigator.vibrate(pattern); } catch { /* 무시 */ }
}
